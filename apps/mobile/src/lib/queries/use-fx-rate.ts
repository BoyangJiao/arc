/**
 * useFxRate — fetch FX rate from one currency to another.
 *
 * Same caching pattern as usePrice (DB cache → adapter → write-back).
 * Used by Portfolio detail to convert per-asset native value to reporting currency.
 *
 * Same-currency requests short-circuit to rate=1 inside the Frankfurter adapter,
 * but we also avoid the query entirely when from === to (saves a render cycle).
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import type { Currency, FxRate } from "@arc/core";
import { fetchFxWithCache } from "@arc/data-sources";

import { fxCache, registry } from "../market-data";

export interface UseFxRateOptions {
  freshnessMs?: number;
  enabled?: boolean;
}

export const useFxRate = (
  from: Currency | null | undefined,
  to: Currency | null | undefined,
  opts: UseFxRateOptions = {}
): UseQueryResult<FxRate, Error> => {
  const sameCurrency = from && to && from === to;

  return useQuery({
    queryKey: ["fx", from, to, opts.freshnessMs],
    enabled: !!from && !!to && opts.enabled !== false,
    queryFn: async (): Promise<FxRate> => {
      if (!from || !to) {
        throw new Error("from and to currencies are required");
      }
      if (sameCurrency) {
        return {
          from,
          to,
          rate: new Decimal(1),
          asOf: new Date().toISOString(),
          source: "identity",
        };
      }
      return fetchFxWithCache({
        adapter: registry.fxAdapter,
        from,
        to,
        cache: fxCache,
        freshnessMs: opts.freshnessMs,
      });
    },
  });
};
