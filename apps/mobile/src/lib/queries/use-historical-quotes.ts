/**
 * Historical EOD quotes for asset detail / portfolio charts.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { composeAssetId, parseAssetId, type PriceQuote } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { getRegistry } from "../market-data";
import { rangeToWindow } from "../time-range";

export const useHistoricalQuotes = (assetId: string | undefined, range: TimeRange) => {
  const window = useMemo(() => rangeToWindow(range), [range]);

  return useQuery({
    queryKey: ["historical", assetId, window.from.toISOString(), window.to.toISOString()],
    enabled: !!assetId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<readonly PriceQuote[]> => {
      if (!assetId) return [];
      const adapter = getRegistry().resolvePriceAdapterByAssetId(assetId);
      if (!adapter.fetchHistorical) return [];
      const { symbol } = parseAssetId(assetId);
      return adapter.fetchHistorical(symbol, window.from, window.to);
    },
  });
};

/** Map historical quotes to chart points (sorted by asOf). */
export const historicalQuotesToChartPoints = (
  quotes: readonly PriceQuote[]
): ReadonlyArray<{ x: number; y: number }> => {
  const sorted = [...quotes].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf));
  return sorted.map((q, index) => ({
    x: index,
    y: q.price.toNumber(),
  }));
};

export const assetIdFromRoute = (market: string, symbol: string): string =>
  composeAssetId(market as Parameters<typeof composeAssetId>[0], symbol);
