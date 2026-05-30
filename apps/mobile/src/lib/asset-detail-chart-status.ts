/**
 * Derive asset-detail chart plot status from TanStack Query historical quotes.
 */

import type { UseQueryResult } from "@tanstack/react-query";
import type { PriceQuote } from "@arc/core";

import type { AssetDetailChartPlotStatus } from "../components/AssetDetailChartEmptyPlot";

export const resolveAssetDetailChartStatus = (
  historical: Pick<
    UseQueryResult<readonly PriceQuote[]>,
    "isFetching" | "isError" | "isSuccess" | "data"
  >,
  chartPointCount: number
): AssetDetailChartPlotStatus => {
  if (historical.isFetching && chartPointCount === 0) {
    return "loading";
  }
  if (historical.isError) {
    return "error";
  }
  if (historical.isSuccess && chartPointCount === 0) {
    return "empty";
  }
  return "ready";
};
