/**
 * validateUsSymbol — pre-flight check before recording a US equity transaction.
 *
 * cache-first: reuse any cached quote (device / Supabase); only call Alpha Vantage
 * when there is no cache yet (first time adding that ticker).
 *
 * live: normal fetchPriceWithCache with 15 min freshness.
 */

import type { PriceQuote } from "@arc/core";
import {
  DEFAULT_PRICE_FRESHNESS_MS,
  fetchPriceWithCache,
  NotFoundError,
  RateLimitError,
} from "@arc/data-sources";

import {
  CACHE_FIRST_READ_FRESHNESS_MS,
  isCacheFirstMarketData,
  isLiveMarketData,
} from "./market-data-policy";
import { getRegistry, priceCache } from "./market-data";

export type ValidateUsSymbolResult =
  | { ok: true; quote: PriceQuote }
  | { ok: false; code: "not_found" | "rate_limited" | "no_adapter" | "unknown"; message: string };

export const validateUsSymbol = async (symbol: string): Promise<ValidateUsSymbolResult> => {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(normalized)) {
    return {
      ok: false,
      code: "not_found",
      message: "Invalid ticker format",
    };
  }

  const assetId = `US:${normalized}`;

  let adapter;
  try {
    adapter = getRegistry().resolvePriceAdapterByAssetId(assetId);
  } catch {
    return { ok: false, code: "no_adapter", message: "US market adapter not configured" };
  }

  // fixture / cache-first → any cached row is fresh; live → 15min window.
  const readFreshness = isLiveMarketData()
    ? DEFAULT_PRICE_FRESHNESS_MS
    : CACHE_FIRST_READ_FRESHNESS_MS;

  const cached = await priceCache.get(assetId, readFreshness);
  if (cached) {
    return { ok: true, quote: cached };
  }

  if (isCacheFirstMarketData()) {
    console.info(`[validateUsSymbol] cache miss for ${assetId} — one live quote fetch`);
  }

  try {
    const quote = await fetchPriceWithCache({
      adapter,
      symbol: normalized,
      cache: priceCache,
      freshnessMs: 0,
    });
    return { ok: true, quote };
  } catch (err) {
    if (err instanceof NotFoundError) {
      return { ok: false, code: "not_found", message: err.message };
    }
    if (err instanceof RateLimitError) {
      return { ok: false, code: "rate_limited", message: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "unknown", message };
  }
};
