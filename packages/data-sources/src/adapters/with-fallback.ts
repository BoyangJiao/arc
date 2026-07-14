/**
 * PriceAdapter fallback wrapper — ADR 011 §决策三
 */

import {
  AdapterError,
  NetworkError,
  NotImplementedError,
  QuotaError,
  RateLimitError,
} from "../errors";
import type { PriceAdapter } from "../interfaces";

export type FallbackDecision = "try-secondary" | "bubble";

export const defaultFallbackClassifier = (err: unknown): FallbackDecision => {
  if (err instanceof RateLimitError) return "try-secondary";
  if (err instanceof QuotaError) return "try-secondary";
  if (err instanceof NotImplementedError) return "try-secondary";
  if (err instanceof NetworkError) {
    const causeStr = String(err.cause ?? "");
    if (
      causeStr.includes("40001") ||
      causeStr.includes("HTTP 401") ||
      causeStr.includes("HTTP 403")
    ) {
      return "bubble";
    }
    return "try-secondary";
  }
  return "bubble";
};

export const withFallback = (
  primary: PriceAdapter,
  secondary: PriceAdapter,
  classifier: (err: unknown) => FallbackDecision = defaultFallbackClassifier
): PriceAdapter => {
  const wrap =
    <T>(fn: (adapter: PriceAdapter) => Promise<T>) =>
    async (): Promise<T> => {
      try {
        return await fn(primary);
      } catch (err) {
        if (classifier(err) === "try-secondary") {
          if (err instanceof AdapterError) {
            console.warn({
              primary: primary.source,
              secondary: secondary.source,
              reason: err.name,
            });
          }
          return fn(secondary);
        }
        throw err;
      }
    };

  return {
    market: primary.market,
    source: primary.source,

    fetchLatest: (symbol) => wrap((a) => a.fetchLatest(symbol))(),
    fetchHistorical: primary.fetchHistorical
      ? (symbol, from, to) => wrap((a) => a.fetchHistorical!(symbol, from, to))()
      : undefined,
    searchSymbols:
      (primary.searchSymbols ?? secondary.searchSymbols)
        ? async (query) => {
            if (primary.searchSymbols) {
              try {
                return await primary.searchSymbols(query);
              } catch (err) {
                if (classifier(err) !== "try-secondary" || !secondary.searchSymbols) {
                  throw err;
                }
              }
            }
            if (secondary.searchSymbols) {
              return secondary.searchSymbols(query);
            }
            throw new NotImplementedError(primary.source, "searchSymbols");
          }
        : undefined,
  };
};
