/**
 * Map holdings + valuation + catalog → HoldingsTable rows.
 */

import Decimal from "decimal.js";
import { parseAssetId, type Currency, type Holding, type Market } from "@arc/core";
import type { MarketValuation } from "@arc/core";
import type { HoldingPeriodChange, HoldingsTableRow } from "@arc/ui";

import type { AssetCatalogRow } from "./queries/use-asset-catalog";
import { resolveAssetLogoUrl } from "./asset-logo-url";
import { formatMoney } from "./format-money";

const MARKET_ORDER: readonly Market[] = ["US", "CN", "HK", "FUND", "CRYPTO", "CASH"];

/**
 * Holdings row period change — cost-basis since open (ADR 016).
 *
 * Fixed for all time ranges; does not use chart baseline (ADR 015 superseded).
 */
const resolvePeriodChange = (
  valueReporting: Decimal,
  costBasisReporting: Decimal | undefined
): HoldingPeriodChange => {
  if (costBasisReporting === undefined || costBasisReporting.isZero()) {
    return { kind: "new-position" };
  }
  const delta = valueReporting.minus(costBasisReporting);
  const percent = delta.dividedBy(costBasisReporting).times(100);
  return { kind: "ok", delta, percent };
};

export const buildHoldingsTableRows = (input: {
  holdings: readonly Holding[];
  perAsset: readonly MarketValuation[];
  catalog: ReadonlyMap<string, AssetCatalogRow> | undefined;
  reportingCurrency: Currency;
  quoteLoading: boolean;
  formatPeriodChangeLine: (delta: Decimal, percent: Decimal | null) => string;
  positionLabel: (shares: Decimal, market: Market, symbol: string) => string;
  marketLabel: (market: Market) => string;
  newPositionLabel: string;
  formatAccessibilityLabel: (args: {
    symbol: string;
    name: string;
    valueLabel: string;
    periodChange: HoldingPeriodChange;
  }) => string;
}): HoldingsTableRow[] => {
  const valByAsset = new Map(input.perAsset.map((v) => [v.assetId, v]));
  const rows: HoldingsTableRow[] = [];

  for (const holding of input.holdings) {
    const val = valByAsset.get(holding.assetId);
    const cat = input.catalog?.get(holding.assetId);
    const { market, symbol } = parseAssetId(holding.assetId);
    const name = cat?.name ?? symbol;
    const valueReporting = val?.valueReporting ?? holding.shares.times(holding.averageCost);
    const valueLabel = formatMoney(valueReporting, input.reportingCurrency);
    const periodChange = resolvePeriodChange(valueReporting, val?.costBasisReporting);

    rows.push({
      assetId: holding.assetId,
      market,
      symbol,
      name,
      marketLabel: input.marketLabel(market),
      imageUrl: resolveAssetLogoUrl(market, symbol),
      positionLabel: input.positionLabel(holding.shares, market, symbol),
      valueLabel,
      valueLoading: input.quoteLoading && !val,
      periodChange,
      newPositionLabel: input.newPositionLabel,
      formatPeriodChangeLine: input.formatPeriodChangeLine,
      accessibilityLabel: input.formatAccessibilityLabel({
        symbol,
        name,
        valueLabel,
        periodChange,
      }),
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
