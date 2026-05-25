#!/usr/bin/env node
/**
 * Infer Repomix feature slug from session-state, git activity, and handoffs.
 * Usage: node tools/repomix-infer-slug.mjs [--json] [--verbose]
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = JSON.parse(
  readFileSync(join(ROOT, "tools/repomix-slug-registry.json"), "utf8"),
);

function read(path) {
  const full = join(ROOT, path);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
}

function gitLines(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function scoreSlug(slug, meta, corpus, handoffWithMtime) {
  let score = 0;
  const reasons = [];

  // --- Tier 1: explicit user intent (dominates everything) ---
  if (process.env.CTX_SLUG === slug) {
    score += 1000;
    reasons.push("CTX_SLUG env");
  }

  const explicit = corpus.sessionState.match(
    new RegExp(`\\*\\*Context slug\\*\\*\\s*\\|\\s*\`?${slug}\`?\\b`, "i"),
  );
  if (explicit) {
    score += 500;
    reasons.push("session-state Context slug");
  }

  // --- Tier 2: most-recent handoff (proxy for "next task") ---
  // Recent kickoff filename is the strongest intent signal when session-state is multi-block.
  if (handoffWithMtime.length > 0) {
    const newest = handoffWithMtime[0];
    const slugTokens = [slug, ...(meta.blocks ?? []).map((b) => b.toLowerCase().replace(/\s+/g, "-"))];
    for (const token of slugTokens) {
      if (token && newest.f.toLowerCase().includes(token.toLowerCase())) {
        score += 80;
        reasons.push(`newest-handoff:${newest.f}~${token}`);
        break;
      }
    }
  }

  // --- Tier 3: spec / block / keyword presence in session-state and handoffs ---
  if (corpus.sessionState.includes(meta.spec)) {
    score += 40;
    reasons.push(`spec:${meta.spec}`);
  }

  for (const block of meta.blocks ?? []) {
    if (corpus.sessionState.includes(block)) {
      score += 15;
      reasons.push(`block:${block}`);
    }
  }

  for (const kw of meta.keywords ?? []) {
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(corpus.sessionState)) {
      score += 5;
      reasons.push(`kw-session:${kw}`);
    }
    if (re.test(corpus.handoffs)) {
      score += 8;
      reasons.push(`kw-handoff:${kw}`);
    }
  }

  // --- Tier 4: recent git activity (weakest — reflects PAST work, not next) ---
  for (const path of corpus.changedPaths) {
    for (const prefix of meta.pathPrefixes ?? []) {
      if (path.startsWith(prefix) || path.includes(prefix)) {
        score += 6;
        reasons.push(`path:${path}`);
        break;
      }
    }
    if (path.includes(meta.spec?.replace(".md", "") ?? "___")) {
      score += 12;
      reasons.push(`spec-path:${path}`);
    }
  }

  for (const handoff of handoffWithMtime.slice(1)) {
    if (handoff.f.includes(slug) || handoff.f.includes(meta.spec?.replace("-stage-3.md", "") ?? "___")) {
      score += 8;
      reasons.push(`handoff-file:${handoff.f}`);
    }
  }

  return { slug, score, reasons };
}

export function inferSlug(options = {}) {
  const override = options.slug ?? process.env.CTX_SLUG;
  if (override) {
    if (!REGISTRY.slugs[override]) {
      throw new Error(`Unknown slug override: ${override}`);
    }
    return {
      slug: override,
      score: 999,
      reasons: ["explicit override"],
      confidence: "explicit",
    };
  }

  const sessionState = read(".specify/session-state.md");
  const handoffDir = join(ROOT, ".specify/handoffs");
  const handoffWithMtime = existsSync(handoffDir)
    ? readdirSync(handoffDir)
        .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
        .map((f) => {
          const mtime = statSync(join(handoffDir, f)).mtimeMs;
          return { f, mtime };
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 3)
    : [];

  const handoffs = handoffWithMtime.map((x) => read(`.specify/handoffs/${x.f}`)).join("\n");

  const changedPaths = [
    ...gitLines("git diff --name-only HEAD"),
    ...gitLines("git diff --cached --name-only"),
    ...gitLines("git log -8 --name-only --pretty=format:"),
  ];

  const corpus = { sessionState, handoffs, changedPaths };

  const ranked = Object.entries(REGISTRY.slugs)
    .filter(([, meta]) => meta.autoInferable !== false)
    .map(([slug, meta]) => scoreSlug(slug, meta, corpus, handoffWithMtime))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return { slug: null, score: 0, reasons: [], confidence: "none" };
  }

  const top = ranked[0];
  const second = ranked[1]?.score ?? 0;
  const confidence =
    top.score >= 100 || (top.score >= 40 && top.score >= second * 1.5)
      ? "high"
      : top.score >= 20
        ? "medium"
        : "low";

  return { ...top, confidence, runnerUp: ranked[1]?.slug ?? null };
}

function main() {
  const json = process.argv.includes("--json");
  const verbose = process.argv.includes("--verbose");
  const slugArg = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];

  const result = inferSlug({ slug: slugArg });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.slug ? 0 : 1);
  }

  if (!result.slug) {
    console.log("No Repomix slug inferred (session idle or ambiguous).");
    process.exit(1);
  }

  console.log(`Inferred slug: ${result.slug} (${result.confidence}, score=${result.score})`);
  if (verbose) {
    console.log(`Reasons: ${result.reasons.join("; ")}`);
    if (result.runnerUp) console.log(`Runner-up: ${result.runnerUp}`);
  }
}

if (process.argv[1]?.endsWith("repomix-infer-slug.mjs")) {
  main();
}
