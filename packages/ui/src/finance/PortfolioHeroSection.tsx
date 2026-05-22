/**
 * PortfolioHeroSection — Portfolio Tab hero: total value, daily delta, NAV chart, movers.
 *
 * Scrub: header value + period change mirror chart anchor (Coinbase-style); date on chart.
 */

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Decimal from "decimal.js";
import type { ChartScrubState } from "./chart-scrub";
import { computePeriodChange } from "./compute-period-change";
import type { DailySnapshotDelta } from "./DailySnapshotCard";
import { DailyMoverChips } from "./DailyMoverChips";

import {
  AreaChart,
  CHART_TIME_RANGE_GAP,
  TimeRangeSelector,
  type ChartPoint,
  type TimeRange,
} from "../charts";
import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import {
  TYPO_CAPTION,
  TYPO_CHANGE_LG,
  TYPO_DISPLAY,
  TYPO_EMPTY_MESSAGE,
  TYPO_LABEL,
  typographyClass,
} from "../tokens/typography";

export interface PortfolioHeroSectionProps {
  readonly totalValueTitle: string;
  /** Live portfolio total (valuation) — shown when chart is not scrubbed. */
  readonly liveTotalValue: Decimal;
  readonly formatMoney: (amount: Decimal) => string;
  readonly delta: DailySnapshotDelta | null;
  readonly noBaselineMessage: string;
  /** Coinbase-style single line: ↑¥1,234.56 (+8.15%). */
  readonly formatChangeLine: (delta: Decimal, percent: Decimal | null) => string;
  readonly formatPercent: (percent: Decimal) => string;
  readonly formatAssetLabel: (assetId: string) => string;
  readonly formatAnchorTime: (isoTimestamp: string) => string;
  readonly onMoverPress?: (assetId: string) => void;
  readonly chartData: ReadonlyArray<ChartPoint>;
  readonly chartRange: TimeRange;
  readonly onChartRangeChange: (range: TimeRange) => void;
  readonly chartLoading?: boolean;
  readonly valuePrefix?: string;
  readonly emptyChartMessage?: string;
  readonly maxMovers?: number;
}

const signOf = (value: Decimal): "positive" | "negative" | "zero" => {
  if (value.isZero()) return "zero";
  return value.isNegative() ? "negative" : "positive";
};

const colorClassForSign = (
  sign: "positive" | "negative" | "zero",
  classes: ReturnType<typeof useBusinessClasses>
): string => {
  if (sign === "positive") return classes.gain.text;
  if (sign === "negative") return classes.loss.text;
  return classes.pnlNeutral.text;
};

export function PortfolioHeroSection(props: PortfolioHeroSectionProps): ReactNode {
  const {
    totalValueTitle,
    liveTotalValue,
    formatMoney,
    delta,
    noBaselineMessage,
    formatChangeLine,
    formatPercent,
    formatAssetLabel,
    formatAnchorTime,
    onMoverPress,
    chartData,
    chartRange,
    onChartRangeChange,
    chartLoading = false,
    valuePrefix = "",
    emptyChartMessage,
    maxMovers = 2,
  } = props;

  const businessClasses = useBusinessClasses();
  const [scrub, setScrub] = useState<ChartScrubState | null>(null);
  const hasChart = chartData.length > 0;

  const handleScrubChange = useCallback((next: ChartScrubState | null) => {
    setScrub((prev) => {
      if (next === null) return null;
      if (prev?.index === next.index && prev.value === next.value) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    setScrub(null);
  }, [chartData, chartRange]);

  const periodStart = chartData[0]?.y ?? null;

  const heroValue = useMemo(() => {
    if (scrub) return new Decimal(scrub.value);
    return liveTotalValue;
  }, [scrub, liveTotalValue]);

  const heroChange = useMemo(() => {
    if (scrub && periodStart !== null) {
      return computePeriodChange(scrub.value, periodStart);
    }
    if (delta?.status === "ok") {
      return {
        delta: delta.totalDeltaReporting,
        percent: delta.totalDeltaPercent,
      };
    }
    return null;
  }, [scrub, periodStart, delta]);

  const changeSign = heroChange ? signOf(heroChange.delta) : ("zero" as const);
  const changeColorClass = colorClassForSign(changeSign, businessClasses);

  return (
    <View className="gap-3">
      <Text className={TYPO_LABEL}>{totalValueTitle}</Text>
      <View className="gap-1">
        <Text className={TYPO_DISPLAY}>{formatMoney(heroValue)}</Text>
        <View className="min-h-[24px] justify-center">
          {heroChange ? (
            <Text className={typographyClass("changeLg", changeColorClass)}>
              {formatChangeLine(heroChange.delta, heroChange.percent)}
            </Text>
          ) : delta?.status === "no-baseline" ? (
            <Text className={TYPO_CAPTION}>{noBaselineMessage}</Text>
          ) : null}
        </View>
      </View>

      <View style={{ gap: CHART_TIME_RANGE_GAP }}>
        {hasChart || chartLoading ? (
          <AreaChart
            data={chartData}
            height={208}
            loading={chartLoading}
            valuePrefix={valuePrefix}
            showValueLabel={false}
            formatScrubDate={formatAnchorTime}
            onScrubChange={handleScrubChange}
          />
        ) : emptyChartMessage ? (
          <Text className={typographyClass("emptyMessage", "py-8")}>{emptyChartMessage}</Text>
        ) : null}

        {(hasChart || chartLoading) && (
          <TimeRangeSelector value={chartRange} onChange={onChartRangeChange} />
        )}
      </View>

      {!scrub && delta?.status === "ok" && delta.movers.length > 0 ? (
        <DailyMoverChips
          movers={delta.movers}
          formatPercent={formatPercent}
          formatAssetLabel={formatAssetLabel}
          onMoverPress={onMoverPress}
          maxMovers={maxMovers}
        />
      ) : null}
    </View>
  );
}
