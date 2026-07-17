#!/usr/bin/env node
/**
 * screen-map v0 — 深链截图 sweep（Atlas 运行时观测思想的本地轻量复刻）。
 *
 * 做什么：扫描 Expo Router 路由 → 逐个深链打开 → simctl 截图 →
 * 产出工具无关的 screens.json + 截图目录（打磨 before/after 基线）。
 *
 * 前置：
 *   - 模拟器 Release 包已构建（含 EXPO_PUBLIC_REVYL_BYPASS，登录要用）：
 *     apps/mobile/ios/build/Build/Products/Release-iphonesimulator/Arc.app
 *   - .env.dev.local 有 REVYL_BYPASS_PASSWORD（Clean 账号测试密码）
 *   - fb-idb（`~/.venvs/fb-idb/bin/idb`，Python 3.12 venv；brew idb-companion）—
 *     iOS 对 simctl openurl 的自定义 scheme 会弹「在 Arc 中打开?」确认框，
 *     首条深链后用 idb 在设备内 tap 掉；同设备授权一次后不再弹（实测 iOS 26）
 *
 * 用法：node tools/screen-map/sweep.mjs [--out docs/screen-map/<label>]
 *
 * v1 规划（见 session-state 2026-07-17）：dev-only 导航监听 → 真实转场边。
 */
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const appDir = path.join(repo, "apps/mobile/app");
const APP_BUNDLE = path.join(
  repo,
  "apps/mobile/ios/build/Build/Products/Release-iphonesimulator/Arc.app"
);
const BUNDLE_ID = "com.arc.portfolio";
const SCHEME = "arc";

const outLabel =
  process.argv.includes("--out") && process.argv[process.argv.indexOf("--out") + 1]
    ? process.argv[process.argv.indexOf("--out") + 1]
    : `docs/screen-map/${new Date().toISOString().slice(0, 10)}`;
const outDir = path.join(repo, outLabel);

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", ...opts }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. 路由清单：扫描文件树 ────────────────────────────────────────────────
const SKIP = new Set(["_layout", "+not-found", "+html"]);
// 动态段样例参数（Clean 账号 seed:portfolios:multi-market-full 的已知数据）
const PARAM_SAMPLES = {
  "[market]": "US",
  "[symbol]": "MSFT",
  "[dimension]": "market",
  // "[id]" 运行时从 Supabase 解析（见 resolvePortfolioId）
};
// 需要额外样例的路由（同一动态路由多拍几个状态）
const EXTRA_ROUTES = [
  { route: "/asset/FUND/000216", note: "CN fund asset detail" },
  { route: "/insights/exposure/currency", note: "currency exposure detail" },
];

function scanRoutes(dir, prefix = "") {
  const routes = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      const seg = entry.startsWith("(") ? "" : `/${entry}`;
      routes.push(...scanRoutes(full, prefix + seg));
    } else if (entry.endsWith(".tsx")) {
      const name = entry.replace(/\.tsx$/, "");
      if (SKIP.has(name)) continue;
      const seg = name === "index" ? "" : `/${name}`;
      routes.push(`${prefix}${seg}` || "/");
    }
  }
  return routes;
}

async function resolvePortfolioId() {
  const { createClient } = await import("@supabase/supabase-js");
  const mobileEnv = readFileSync(path.join(repo, "apps/mobile/.env"), "utf8");
  const devEnv = readFileSync(path.join(repo, ".env.dev.local"), "utf8");
  const get = (src, key) =>
    (src.match(new RegExp(`^${key}=(.*)$`, "m")) || [])[1]?.trim()?.replace(/^["']|["']$/g, "");
  const supabase = createClient(
    get(mobileEnv, "EXPO_PUBLIC_SUPABASE_URL"),
    get(mobileEnv, "EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } }
  );
  const email = "cyberjby+arc-clean@gmail.com";
  const password = get(devEnv, "REVYL_BYPASS_PASSWORD");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Clean 账号登录失败: ${error.message}`);
  const { data, error: qe } = await supabase.from("portfolios").select("id").limit(1);
  if (qe || !data?.length) throw new Error(`查询 portfolio 失败: ${qe?.message ?? "empty"}`);
  return { portfolioId: data[0].id, email, password };
}

// ── 2. 模拟器就绪 ──────────────────────────────────────────────────────────
// 固定机型：弹窗 tap 坐标按此机型（1206×2622 @3x → point (274, 473)）标定
const DEVICE_NAME = "iPhone 17 Pro";
const APPROVE_TAP = { x: 274, y: 473 };
const IDB = `${process.env.HOME}/.venvs/fb-idb/bin/idb`;

function ensureSimulator() {
  const bootedLine = sh(`xcrun simctl list devices booted | grep "(Booted)" | head -1 || true`);
  let udid = bootedLine.match(/\(([0-9A-F-]{36})\)/)?.[1];
  if (!udid) {
    const line = sh(`xcrun simctl list devices available | grep "${DEVICE_NAME} (" | head -1`);
    udid = line.match(/\(([0-9A-F-]{36})\)/)?.[1];
    if (!udid) throw new Error(`找不到模拟器 ${DEVICE_NAME}`);
    console.log(`booting ${DEVICE_NAME} …`);
    sh(`xcrun simctl boot ${udid}`);
    sh(`xcrun simctl bootstatus ${udid} -b`, { timeout: 120000 });
  }
  console.log(`simulator booted ✓ (${udid})`);
  return udid;
}

/** iOS 首次经 simctl openurl 打开自定义 scheme 会弹确认框；tap 掉（无框时点到空白处，无害）。 */
async function approveSchemePrompt(udid) {
  await sleep(1500);
  try {
    sh(`"${IDB}" ui tap ${APPROVE_TAP.x} ${APPROVE_TAP.y} --udid ${udid}`);
  } catch {
    console.warn("idb tap 失败（未安装? 弹窗可能未处理）");
  }
  await sleep(1500);
}

// ── 3. sweep ───────────────────────────────────────────────────────────────
const main = async () => {
  const { portfolioId, email, password } = await resolvePortfolioId();
  console.log(`portfolio id: ${portfolioId}`);

  const udid = ensureSimulator();
  if (!existsSync(APP_BUNDLE)) throw new Error(`App 包不存在: ${APP_BUNDLE}（先跑 xcodebuild）`);
  sh(`xcrun simctl install ${udid} "${APP_BUNDLE}"`);
  sh(`xcrun simctl launch ${udid} ${BUNDLE_ID}`);
  await sleep(4000);

  // 登录（bypass 深链；包内已烙 EXPO_PUBLIC_REVYL_BYPASS=true）。
  // 首条深链会弹 scheme 确认框 → idb tap 批准（此后同设备不再弹）。
  const loginUrl = `${SCHEME}://revyl-auth?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  sh(`xcrun simctl openurl ${udid} "${loginUrl}"`);
  await approveSchemePrompt(udid);
  await sleep(5000);
  // 弹窗吞掉首条深链时补发一次（已授权，直接生效）
  sh(`xcrun simctl openurl ${udid} "${loginUrl}"`);
  await sleep(5000);

  const scanned = scanRoutes(appDir)
    .filter((r) => !["/revyl-auth", "/auth/callback", "/sign-in", "/welcome"].includes(r))
    .map((r) =>
      r
        .replace(/\[market\]/g, PARAM_SAMPLES["[market]"])
        .replace(/\[symbol\]/g, PARAM_SAMPLES["[symbol]"])
        .replace(/\[dimension\]/g, PARAM_SAMPLES["[dimension]"])
        .replace(/\[id\]/g, portfolioId)
    );
  const routes = [
    ...new Set([...scanned, ...EXTRA_ROUTES.map((e) => e.route)]),
  ].sort();

  mkdirSync(outDir, { recursive: true });
  const screens = [];
  for (const route of routes) {
    const slug = route === "/" ? "home" : route.slice(1).replace(/\//g, "__");
    const file = `${slug}.png`;
    const url = `${SCHEME}://${route === "/" ? "" : route.slice(1)}`;
    process.stdout.write(`📸 ${route} … `);
    try {
      sh(`xcrun simctl openurl ${udid} "${url}"`);
      await sleep(3000); // 等数据加载 + 动画收敛
      sh(`xcrun simctl io ${udid} screenshot "${path.join(outDir, file)}"`);
      screens.push({ id: slug, route, deepLink: url, screenshot: file, status: "captured" });
      console.log("✓");
    } catch (e) {
      screens.push({ id: slug, route, deepLink: url, screenshot: null, status: "failed" });
      console.log(`✗ ${e.message?.slice(0, 60)}`);
    }
  }

  writeFileSync(
    path.join(outDir, "screens.json"),
    JSON.stringify(
      { capturedAt: new Date().toISOString(), app: BUNDLE_ID, count: screens.length, screens },
      null,
      2
    )
  );
  console.log(`\n完成：${screens.filter((s) => s.status === "captured").length}/${screens.length} 屏 → ${outLabel}/`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
