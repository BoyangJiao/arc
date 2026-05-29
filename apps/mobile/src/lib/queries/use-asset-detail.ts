/**
 * Asset detail bundle — metadata + latest quote + active-portfolio holding.
 */

import { useMemo } from "react";
import Decimal from "decimal.js";
import { composeAssetId, parseAssetId, type Currency, type Market } from "@arc/core";

import { useAssetCatalog } from "./use-asset-catalog";
import { useActivePortfolio } from "./use-active-portfolio";
import { usePortfolioHoldings } from "./use-portfolio-holdings";
import { usePrice } from "./use-price";

export interface AssetDetailView {
  readonly assetId: string;
  readonly market: Market;
  readonly symbol: string;
  readonly name: string;
  readonly currency: Currency;
  readonly latestQuote: ReturnType<typeof usePrice>["data"];
  readonly holding:
    | {
        readonly shares: Decimal;
        readonly averageCost: Decimal;
        readonly totalCostBasis: Decimal;
      }
    | undefined;
  readonly unrealizedPnL: Decimal | null;
}

export const useAssetDetail = (market: string | undefined, symbol: string | undefined) => {
  const assetId = market && symbol ? composeAssetId(market as Market, symbol) : undefined;

  const catalog = useAssetCatalog(assetId ? [assetId] : []);
  const priceQuery = usePrice(assetId);
  const { portfolio: active } = useActivePortfolio();
  const { holdings } = usePortfolioHoldings(active?.id);

  const holding = useMemo(() => holdings.find((h) => h.assetId === assetId), [holdings, assetId]);

  const data = useMemo((): AssetDetailView | null => {
    if (!assetId || !market || !symbol) return null;
    const row = catalog.data?.get(assetId);
    const { market: parsedMarket } = parseAssetId(assetId);
    const name = row?.name ?? symbol;
    const quote = priceQuery.data;

    // 持有收益 semantic (支付宝 / 雪球 / 钱迹): includes cumulative cash dividends.
    // Same formula as holdings-presenter row delta (07f9c5d), in native currency
    // — no FX conversion needed (all three terms come from `holding` accumulators).
    let unrealizedPnL: Decimal | null = null;
    if (holding && quote) {
      const marketValue = holding.shares.times(quote.price);
      unrealizedPnL = marketValue.minus(holding.totalCostBasis).plus(holding.totalDividends);
    }

    return {
      assetId,
      market: parsedMarket,
      symbol,
      name,
      currency: holding?.currency ?? quote?.currency ?? "USD",
      latestQuote: quote,
      holding: holding
        ? {
            shares: holding.shares,
            averageCost: holding.averageCost,
            totalCostBasis: holding.totalCostBasis,
          }
        : undefined,
      unrealizedPnL,
    };
  }, [assetId, market, symbol, catalog.data, priceQuery.data, holding]);

  return {
    data,
    isPending: catalog.isPending || priceQuery.isPending,
    isError: catalog.isError || priceQuery.isError,
    error: catalog.error ?? priceQuery.error,
  };
};
