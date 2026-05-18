#!/usr/bin/env node
/**
 * Copy-compliance grep — forbidden investment-advice tokens in i18n locales.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["packages/i18n/src/locales/en.ts", "packages/i18n/src/locales/zh.ts"];

const rules = [
  { re: /建议买入|建议卖出|应该买|应该卖|推荐购买/g, label: "zh forbidden advice" },
  { re: /\brecommend\b|\bshould buy\b|\bshould sell\b/gi, label: "en forbidden advice" },
  {
    re: /投资建议/g,
    label: "投资建议 (except 不构成投资建议)",
    allow: (line) => line.includes("不构成投资建议") || line.includes("not investment advice"),
  },
];

let hits = 0;

for (const rel of files) {
  const text = readFileSync(resolve(root, rel), "utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of rules) {
      rule.re.lastIndex = 0;
      if (!rule.re.test(line)) continue;
      if (rule.allow?.(line)) continue;
      console.error(`${rel}:${i + 1}: ${rule.label} → ${line.trim()}`);
      hits++;
    }
  }
}

if (hits > 0) {
  process.exit(1);
}

console.log("✅ Copy clean — no forbidden tokens");
