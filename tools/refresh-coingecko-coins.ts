/**
 * Refresh bundled CoinGecko top-200 ticker → coin_id map.
 *
 * Usage: pnpm tsx tools/refresh-coingecko-coins.ts
 *
 * Uses /coins/markets (market_cap_desc) — /coins/list has no rank field.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_PATH = resolve(REPO_ROOT, "packages/data-sources/src/static/coingecko-coins-top200.json");

const TOP_N = 200;

interface CoingeckoMarketRow {
  id: string;
  symbol: string;
  market_cap_rank: number | null;
}

const fetchTopMarkets = async (): Promise<CoingeckoMarketRow[]> => {
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", String(TOP_N));
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`CoinGecko /coins/markets failed: HTTP ${res.status}`);
  }

  return (await res.json()) as CoingeckoMarketRow[];
};

const buildBundledMap = (rows: CoingeckoMarketRow[]): Record<string, string> => {
  const out: Record<string, string> = {};

  for (const row of rows) {
    const ticker = row.symbol.toUpperCase();
    // Keep highest market-cap coin when multiple share a ticker symbol.
    if (out[ticker]) continue;
    out[ticker] = row.id;
  }

  return out;
};

const main = async () => {
  const rows = await fetchTopMarkets();
  const map = buildBundledMap(rows);
  const entries = Object.keys(map).length;

  if (entries < TOP_N - 20) {
    console.warn(`Warning: only ${entries} unique tickers (expected ~${TOP_N})`);
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  console.log(`Wrote ${entries} entries to ${OUT_PATH}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
