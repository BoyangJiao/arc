/**
 * Map holdings + valuation + catalog → HoldingsTable rows.
 */

import Decimal from "decimal.js";
import { parseAssetId, type Currency, type Holding, type Market } from "@arc/core";
import type { MarketValuation } from "@arc/core";
import type { HoldingsTableRow } from "@arc/ui";

import type { AssetCatalogRow } from "./queries/use-asset-catalog";
import { formatMoney } from "./format-money";

const MARKET_ORDER: readonly Market[] = ["US", "CN", "HK", "FUND", "CRYPTO", "CASH"];

export const buildHoldingsTableRows = (input: {
  holdings: readonly Holding[];
  perAsset: readonly MarketValuation[];
  catalog: ReadonlyMap<string, AssetCatalogRow> | undefined;
  reportingCurrency: Currency;
  formatPercent: (d: Decimal) => string;
  sharesLabel: (shares: Decimal, symbol: string) => string;
}): HoldingsTableRow[] => {
  const valByAsset = new Map(input.perAsset.map((v) => [v.assetId, v]));

  const rows: HoldingsTableRow[] = [];

  for (const holding of input.holdings) {
    const val = valByAsset.get(holding.assetId);
    const cat = input.catalog?.get(holding.assetId);
    const { market, symbol } = parseAssetId(holding.assetId);
    const name = cat?.name ?? symbol;
    const nativeCurrency = holding.currency;
    const nativeValue = val?.valueNative ?? holding.shares.times(holding.averageCost);
    const reportingValue = val?.valueReporting ?? nativeValue;
    const price = val?.priceNative ?? holding.averageCost;
    const changePercent = val?.unrealizedPnLPercent ?? null;
    const dualCurrency = nativeCurrency !== input.reportingCurrency;

    rows.push({
      assetId: holding.assetId,
      market,
      symbol,
      name,
      sharesLabel: input.sharesLabel(holding.shares, symbol),
      priceLabel: formatMoney(price, nativeCurrency),
      nativeValueLabel: formatMoney(nativeValue, nativeCurrency),
      reportingValueLabel: dualCurrency
        ? formatMoney(reportingValue, input.reportingCurrency)
        : undefined,
      changePercent,
      formatPercent: input.formatPercent,
    });
  }

  rows.sort((a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market));

  return rows;
};

export const formatMarketSectionHeader = (
  marketLabel: string,
  rows: readonly HoldingsTableRow[],
  perAsset: readonly MarketValuation[],
  reportingCurrency: Currency
): string => {
  const assetIds = new Set(rows.map((r) => r.assetId));
  let nativeTotal = new Decimal(0);
  let reportingTotal = new Decimal(0);
  let nativeCurrency: Currency = reportingCurrency;

  for (const v of perAsset) {
    if (!assetIds.has(v.assetId)) continue;
    nativeTotal = nativeTotal.plus(v.valueNative);
    reportingTotal = reportingTotal.plus(v.valueReporting);
    nativeCurrency = v.nativeCurrency;
  }

  if (nativeCurrency === reportingCurrency) {
    return `${marketLabel} · ${formatMoney(nativeTotal, nativeCurrency)}`;
  }
  return `${marketLabel} · ${formatMoney(nativeTotal, nativeCurrency)} / ${formatMoney(reportingTotal, reportingCurrency)}`;
};
