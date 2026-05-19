/**
 * Client-side watchlist seed — signed-in user JWT only (no Edge Function).
 *
 * Touches watchlist_items + assets + price_snapshots only; portfolio data unchanged.
 */

import type { WatchlistScenarioId } from "./scenarios";
import { supabase } from "../supabase";

const SEED_ASSETS = [
  { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple Inc.", currency: "USD" },
  {
    id: "US:MSFT",
    market: "US",
    symbol: "MSFT",
    name: "Microsoft Corporation",
    currency: "USD",
  },
  {
    id: "US:NVDA",
    market: "US",
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    currency: "USD",
  },
] as const;

const WATCHLIST_PLANS: Record<
  WatchlistScenarioId,
  { assetIds: readonly string[]; staleQuotes?: boolean }
> = {
  "watchlist:empty": { assetIds: [] },
  "watchlist:3-items": { assetIds: ["US:AAPL", "US:MSFT", "US:NVDA"] },
  "watchlist:stale-quotes": {
    assetIds: ["US:AAPL", "US:MSFT", "US:NVDA"],
    staleQuotes: true,
  },
};

const WL_PRICES: Record<string, string> = {
  "US:AAPL": "189.50",
  "US:MSFT": "420.30",
  "US:NVDA": "875.00",
};

/** Aligns with `apps/mobile/src/lib/dev-fixtures/quotes.json` for watchlist chip UAT. */
const WL_CHANGE_PERCENT: Record<string, string> = {
  "US:AAPL": "-0.42",
  "US:MSFT": "1.05",
  "US:NVDA": "3.21",
};

export class WatchlistSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WatchlistSeedError";
  }
}

export const runWatchlistSeedClient = async (
  scenario: WatchlistScenarioId,
  userId: string
): Promise<void> => {
  const plan = WATCHLIST_PLANS[scenario];

  const { error: delErr } = await supabase.from("watchlist_items").delete().eq("user_id", userId);
  if (delErr) {
    const msg = delErr.message ?? "";
    if (/watchlist_items/i.test(msg) && /does not exist|schema cache/i.test(msg)) {
      throw new WatchlistSeedError(
        "watchlist_items 表不存在 — 请在 Supabase 执行 migration 0004_watchlist_items.sql"
      );
    }
    throw new WatchlistSeedError(`清空自选失败: ${msg}`);
  }

  if (plan.assetIds.length === 0) {
    return;
  }

  const watchAssets = plan.assetIds.map((id) => {
    const found = SEED_ASSETS.find((a) => a.id === id);
    if (!found) throw new WatchlistSeedError(`未知 asset id: ${id}`);
    return found;
  });

  const { error: assetErr } = await supabase
    .from("assets")
    .upsert(watchAssets as never, { onConflict: "id", ignoreDuplicates: true });
  if (assetErr) {
    throw new WatchlistSeedError(`写入 assets 失败: ${assetErr.message}`);
  }

  const wlRows = watchAssets.map((a) => ({
    user_id: userId,
    asset_id: a.id,
  }));
  const { error: insErr } = await supabase.from("watchlist_items").insert(wlRows);
  if (insErr) {
    throw new WatchlistSeedError(`写入 watchlist_items 失败: ${insErr.message}`);
  }

  const quoteAsOf = plan.staleQuotes
    ? new Date(Date.now() - 10 * 60 * 1000).toISOString()
    : new Date().toISOString();

  const priceRows = watchAssets.map((a) => ({
    asset_id: a.id,
    as_of: quoteAsOf,
    price: WL_PRICES[a.id] ?? "100.00",
    currency: "USD",
    source: "seed-dev",
    change_percent: WL_CHANGE_PERCENT[a.id] ?? null,
  }));

  const { error: priceErr } = await supabase
    .from("price_snapshots")
    .upsert(priceRows as never, { onConflict: "asset_id,as_of" });
  if (priceErr) {
    throw new WatchlistSeedError(`写入 price_snapshots 失败: ${priceErr.message}`);
  }
};
