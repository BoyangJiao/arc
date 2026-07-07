/**
 * Asset detail — live quote, period change (chart-range), loading skeleton.
 *
 * Layout/spacing owned here — not shared with PortfolioHeroSection.
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { View } from "react-native";
import type { Currency } from "@arc/core";
import type { Decimal } from "decimal.js";
import {
  Skeleton,
  Text,
  TYPO_CAPTION,
  computePeriodChange,
  firstNonZeroChartY,
  formatCompactChangeLine,
  formatSignedPercent,
  typographyClass,
  useBusinessClasses,
  type ChartPoint,
  type TimeRange,
} from "@arc/ui";

import { formatMoney, currencySymbol } from "../lib/format-money";

export interface AssetDetailPriceHeaderProps {
  readonly assetId: string | undefined;
  readonly disclaimer: string;
  readonly quote: { price: Decimal; currency: Currency; changePercent: Decimal | null } | undefined;
  readonly chartData: ReadonlyArray<ChartPoint>;
  readonly range: TimeRange;
  readonly periodChangeLabel: string;
  readonly chartPeriodLoading: boolean;
  /** Historical chart failed — show em dash instead of daily-change fallback. */
  readonly chartPeriodUnavailable: boolean;
  readonly unavailableLabel: string;
  readonly detailPending: boolean;
  readonly loadingLabel: string;
  readonly amountsHidden?: boolean;
}

export function AssetDetailPriceHeader({
  assetId,
  disclaimer,
  quote,
  chartData,
  range,
  periodChangeLabel,
  chartPeriodLoading,
  chartPeriodUnavailable,
  unavailableLabel,
  detailPending,
  loadingLabel,
  amountsHidden = false,
}: AssetDetailPriceHeaderProps): ReactNode {
  const businessClasses = useBusinessClasses();
  const currencySym = quote ? currencySymbol(quote.currency) : "";

  const periodStart = useMemo(() => firstNonZeroChartY(chartData), [chartData]);

  const periodChange = useMemo(() => {
    if (chartPeriodLoading || chartPeriodUnavailable || !quote || periodStart === null) return null;
    return computePeriodChange(quote.price.toNumber(), periodStart);
  }, [chartPeriodLoading, chartPeriodUnavailable, quote, periodStart]);

  const changeColorClass =
    periodChange !== null
      ? periodChange.delta.isPositive()
        ? businessClasses.gain.text
        : periodChange.delta.isNegative()
          ? businessClasses.loss.text
          : businessClasses.pnlNeutral.text
      : quote?.changePercent === null || quote?.changePercent === undefined
        ? businessClasses.pnlNeutral.text
        : quote.changePercent.isPositive()
          ? businessClasses.gain.text
          : quote.changePercent.isNegative()
            ? businessClasses.loss.text
            : businessClasses.pnlNeutral.text;

  return (
    <View>
      <Text className="text-muted text-sm">
        {assetId} · {disclaimer}
      </Text>
      {quote ? (
        <View className="mt-1 gap-0.5">
          <Text className="text-foreground text-2xl font-bold">
            {formatMoney(quote.price, quote.currency, { redact: amountsHidden })}
          </Text>
          {chartPeriodLoading ? (
            <View className="gap-1 py-0.5">
              <Skeleton className="h-4 w-36 rounded-md" />
            </View>
          ) : chartPeriodUnavailable ? (
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
              <Text className={typographyClass("rowValue", businessClasses.pnlNeutral.text)}>
                {unavailableLabel}
              </Text>
              <Text className={`${TYPO_CAPTION} text-muted`}>{periodChangeLabel}</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
              {periodChange ? (
                <Text className={typographyClass("rowValue", changeColorClass)}>
                  {formatCompactChangeLine(periodChange.delta, periodChange.percent, currencySym, {
                    redactAmount: amountsHidden,
                  })}
                </Text>
              ) : quote.changePercent !== null ? (
                <Text className={typographyClass("rowValue", changeColorClass)}>
                  {formatSignedPercent(quote.changePercent)}
                </Text>
              ) : null}
              {periodStart !== null ? (
                <Text className={`${TYPO_CAPTION} text-muted`}>{periodChangeLabel}</Text>
              ) : null}
            </View>
          )}
        </View>
      ) : detailPending ? (
        <Text className="text-muted mt-2">{loadingLabel}</Text>
      ) : null}
    </View>
  );
}
