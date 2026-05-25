#!/usr/bin/env node
/**
 * Auto ensure Repomix context bundle for the active task (no manual slug).
 * Usage:
 *   pnpm ctx:auto [--ensure] [--dump] [--quiet] [--json] [--slug twr]
 */
import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inferSlug } from "./repomix-infer-slug.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = JSON.parse(
  readFileSync(join(ROOT, "tools/repomix-slug-registry.json"), "utf8"),
);

function parseArgs(argv) {
  const args = {
    ensure: argv.includes("--ensure"),
    dump: argv.includes("--dump"),
    quiet: argv.includes("--quiet"),
    json: argv.includes("--json"),
    slug: argv.find((a) => a.startsWith("--slug="))?.split("=")[1],
  };
  if (!args.ensure && !args.dump && !args.json) args.ensure = true;
  return args;
}

function mtime(path) {
  return existsSync(path) ? statSync(path).mtimeMs : 0;
}

function isStale(slug, outputPath) {
  if (!existsSync(outputPath)) return { stale: true, reason: "missing" };

  const bundleMtime = mtime(outputPath);
  const meta = REGISTRY.slugs[slug];

  // Staleness is decided by SOURCE files only.
  // Intentionally NOT triggered by session-state.md / spec mtime — those would cause
  // checkpoint → session-state write → next session rebuild churn even when code is unchanged.
  // If the user wants a forced refresh, run `pnpm ctx:auto --slug=<x>` or delete the bundle.
  try {
    const changed = execSync("git diff --name-only HEAD && git diff --cached --name-only", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .filter(Boolean);

    for (const file of changed) {
      for (const prefix of meta.pathPrefixes ?? []) {
        if (file.startsWith(prefix) || file.includes(prefix.replace(/\/$/, ""))) {
          const fm = mtime(join(ROOT, file));
          if (fm > bundleMtime) return { stale: true, reason: `changed:${file}` };
        }
      }
    }
  } catch {
    /* no git — fall through to fresh */
  }

  // 24h hard floor: refresh at least once a day so long-running branches don't drift.
  const ageMs = Date.now() - bundleMtime;
  if (ageMs > 24 * 60 * 60 * 1000) return { stale: true, reason: "age>24h" };

  return { stale: false, reason: "fresh" };
}

function runRepomix(configPath, outputPath) {
  const relOut = outputPath.startsWith("/") ? outputPath : join(ROOT, outputPath);
  mkdirSync(dirname(relOut), { recursive: true });
  const relConfig = configPath.startsWith("/") ? configPath : join(ROOT, configPath);

  const result = spawnSync("pnpm", ["exec", "repomix", "-c", relConfig, "-o", relOut, "--quiet"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "repomix failed");
  }
}

function writeActivePointer(payload) {
  writeFileSync(join(ROOT, ".specify/codectx/.active.json"), JSON.stringify(payload, null, 2));
}

export function autoContext(options = {}) {
  const inferred = inferSlug({ slug: options.slug });
  if (!inferred.slug) {
    return {
      ok: false,
      skipped: true,
      reason: "no slug inferred",
      slug: null,
      path: null,
    };
  }

  if (inferred.confidence === "low" && !options.slug && !process.env.CTX_SLUG) {
    return {
      ok: false,
      skipped: true,
      reason: "low confidence",
      slug: inferred.slug,
      confidence: inferred.confidence,
      path: null,
    };
  }

  const meta = REGISTRY.slugs[inferred.slug];
  const configPath = meta.config;
  let outputPath = meta.output;

  if (options.dump) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    outputPath = `.specify/codectx/${inferred.slug}-${ts}.xml`;
  }

  const fullOut = join(ROOT, outputPath);
  const { stale, reason: staleReason } = isStale(inferred.slug, fullOut);

  if (!options.ensure && existsSync(fullOut)) {
    const payload = {
      slug: inferred.slug,
      path: outputPath,
      generatedAt: new Date(statSync(fullOut).mtime).toISOString(),
      stale: false,
      skipped: true,
      confidence: inferred.confidence,
    };
    writeActivePointer(payload);
    return { ok: true, ...payload, action: "skipped-existing" };
  }

  if (options.ensure && !stale && existsSync(fullOut)) {
    const payload = {
      slug: inferred.slug,
      path: outputPath,
      generatedAt: new Date(statSync(fullOut).mtime).toISOString(),
      stale: false,
      skipped: true,
      confidence: inferred.confidence,
    };
    writeActivePointer(payload);
    return { ok: true, ...payload, action: "skipped-fresh" };
  }

  runRepomix(configPath, outputPath);

  const payload = {
    slug: inferred.slug,
    path: outputPath,
    generatedAt: new Date().toISOString(),
    stale: false,
    skipped: false,
    confidence: inferred.confidence,
    staleReason,
  };
  writeActivePointer(payload);
  return { ok: true, ...payload, action: "generated" };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const result = autoContext(args);

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    }

    if (result.skipped && result.reason === "no slug inferred") {
      if (!args.quiet) console.log("ctx:auto — no active feature slug inferred; skip Repomix.");
      process.exit(0);
    }

    if (result.skipped && result.reason === "low confidence") {
      if (!args.quiet)
        console.log(
          `ctx:auto — slug '${result.slug}' confidence low; skip (set CTX_SLUG=${result.slug} to force).`,
        );
      process.exit(0);
    }

    if (!args.quiet) {
      if (result.action === "generated") {
        console.log(`📦 Context bundle generated: ${result.slug} → ${result.path}`);
      } else {
        console.log(`📦 Context bundle fresh: ${result.slug} → ${result.path}`);
      }
    }

    process.exit(0);
  } catch (err) {
    if (args.json) {
      console.log(JSON.stringify({ ok: false, error: String(err.message ?? err) }));
    } else {
      console.error(`ctx:auto failed: ${err.message ?? err}`);
    }
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("repomix-auto-context.mjs")) {
  main();
}
