/**
 * validateUsSymbol — pre-flight check before recording a US equity transaction.
 *
 * Uses the same Alpha Vantage GLOBAL_QUOTE path as portfolio valuation so
 * invalid tickers (e.g. ROOD) are rejected at submit time, not after save.
 */

import type { PriceQuote } from "@arc/core";
import { NotFoundError, RateLimitError } from "@arc/data-sources";

import { registry } from "./market-data";

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

  let adapter;
  try {
    adapter = registry.resolvePriceAdapterByAssetId(`US:${normalized}`);
  } catch {
    return { ok: false, code: "no_adapter", message: "US market adapter not configured" };
  }

  try {
    const quote = await adapter.fetchLatest(normalized);
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
