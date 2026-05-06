// Headless render verification for the spike.
// Run: node headless-check.mjs (uses puppeteer via npx)
import puppeteer from "puppeteer";

const URL = "http://localhost:4555/";

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();

const consoleMsgs = [];
const pageErrors = [];
const requestFails = [];

page.on("console", (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
page.on("pageerror", (err) => pageErrors.push(String(err)));
page.on("requestfailed", (req) =>
  requestFails.push({ url: req.url(), reason: req.failure()?.errorText })
);

try {
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
} catch (e) {
  console.log("NAV_ERROR:", e.message);
}

// Give RN render a beat to mount
await new Promise((r) => setTimeout(r, 1500));

const rootHtml = await page.evaluate(() => {
  const root = document.getElementById("root");
  return {
    rootChildCount: root?.children?.length ?? 0,
    rootInnerHtmlLen: root?.innerHTML?.length ?? 0,
    bodyText: document.body.innerText.slice(0, 500),
    sampleHtml: root?.innerHTML?.slice(0, 1500) ?? "",
  };
});

console.log("\n=== PAGE ERRORS (runtime) ===");
console.log(pageErrors.length === 0 ? "(none)" : pageErrors.join("\n"));

console.log("\n=== FAILED REQUESTS ===");
console.log(requestFails.length === 0 ? "(none)" : JSON.stringify(requestFails, null, 2));

console.log("\n=== CONSOLE (errors+warnings only) ===");
const significant = consoleMsgs.filter((m) => ["error", "warning"].includes(m.type));
console.log(significant.length === 0 ? "(none)" : JSON.stringify(significant, null, 2));

console.log("\n=== ROOT MOUNT ===");
console.log(JSON.stringify({ ...rootHtml, sampleHtml: rootHtml.sampleHtml.slice(0, 400) }, null, 2));

await page.screenshot({ path: "spike-render.png", fullPage: true });
console.log("\nScreenshot: tools/spike-heroui-native/spike-render.png");

await browser.close();
