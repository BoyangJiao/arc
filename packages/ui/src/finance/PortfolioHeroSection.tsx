/**
 * PortfolioHeroSection — Portfolio Tab hero: total value, period change, NAV chart.
 *
 * Scrub: header value + period change mirror chart anchor (Coinbase-style); date on chart.
 * Daily P&L card lives below this section (`DailySnapshotCard`).
 */

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Decimal from "decimal.js";
import { useSharedValue } from "react-native-reanimated";
import type { ChartScrubState } from "./chart-scrub";
import { computePeriodChange, firstNonZeroChartY } from "./compute-period-change";
import { FlippingNumberText } from "./FlippingNumberText";

import {
  AreaChart,
  CHART_TIME_RANGE_GAP,
  TimeRangeSelector,
  type ChartPoint,
  type TimeRange,
} from "../charts";
import { Skeleton, Text } from "../primitives";
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
  /** e.g. 「过去1个月」— matches selected chart time range (ADR 016). */
  readonly periodChangeLabel: string;
  readonly formatChangeLine: (delta: Decimal, percent: Decimal | null) => string;
  readonly formatAnchorTime: (isoTimestamp: string) => string;
  readonly chartData: ReadonlyArray<ChartPoint>;
  readonly chartRange: TimeRange;
  readonly onChartRangeChange: (range: TimeRange) => void;
  readonly chartLoading?: boolean;
  readonly valuePrefix?: string;
  readonly emptyChartMessage?: string;
  /** Optional TWR row (linked to chartRange in parent). */
  readonly twrInline?: ReactNode;
  /** Placed beside total value (e.g. amount visibility eye toggle). */
  readonly totalValueAccessory?: ReactNode;
  /** When set, the period-change block becomes a tappable entry to 盈亏分析
   *  (ADR 016 §决策 1; carries the current chartRange). */
  readonly onPeriodChangePress?: () => void;
  /** a11y label for the period-change entry chip. */
  readonly periodChangeAccessibilityLabel?: string;
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
    periodChangeLabel,
    formatChangeLine,
    formatAnchorTime,
    chartData,
    chartRange,
    onChartRangeChange,
    chartLoading = false,
    valuePrefix = "",
    emptyChartMessage,
    twrInline,
    totalValueAccessory,
    onPeriodChangePress,
    periodChangeAccessibilityLabel,
  } = props;

  const businessClasses = useBusinessClasses();
  const [scrub, setScrub] = useState<ChartScrubState | null>(null);
  const scrubValueSv = useSharedValue(0);
  const scrubActiveSv = useSharedValue(false);
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

  const periodStart = useMemo(() => firstNonZeroChartY(chartData), [chartData]);

  const heroValue = useMemo(() => {
    if (scrub) return new Decimal(scrub.value);
    return liveTotalValue;
  }, [scrub, liveTotalValue]);

  const heroChange = useMemo(() => {
    if (chartLoading) return null;
    if (scrub && periodStart !== null) {
      return computePeriodChange(scrub.value, periodStart);
    }
    if (hasChart && periodStart !== null) {
      return computePeriodChange(liveTotalValue.toNumber(), periodStart);
    }
    return null;
  }, [chartLoading, scrub, periodStart, hasChart, liveTotalValue]);

  const changeSign = heroChange ? signOf(heroChange.delta) : ("zero" as const);
  const changeColorClass = colorClassForSign(changeSign, businessClasses);

  return (
    <View className="gap-3">
      <Text className={TYPO_LABEL}>{totalValueTitle}</Text>
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 min-w-0">
            <FlippingNumberText
              value={formatMoney(heroValue)}
              className={TYPO_DISPLAY}
              liveValue={scrubValueSv}
              liveActive={scrubActiveSv}
            />
          </View>
          {totalValueAccessory ? (
            <View className="shrink-0 self-center">{totalValueAccessory}</View>
          ) : null}
        </View>
        {(() => {
          const periodInner = chartLoading ? (
            <>
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-6 w-40 rounded-md" />
            </>
          ) : heroChange ? (
            <>
              <Text className={TYPO_CAPTION}>{periodChangeLabel}</Text>
              <Text className={typographyClass("changeLg", changeColorClass)}>
                {formatChangeLine(heroChange.delta, heroChange.percent)}
              </Text>
            </>
          ) : hasChart ? (
            <Text className={TYPO_CAPTION}>{periodChangeLabel}</Text>
          ) : null;

          // Only a tappable chip once there is a real period change to drill into.
          return onPeriodChangePress && heroChange && !chartLoading ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={periodChangeAccessibilityLabel ?? periodChangeLabel}
              onPress={onPeriodChangePress}
              className="min-h-[40px] justify-center gap-0.5 active:opacity-60"
            >
              {periodInner}
            </Pressable>
          ) : (
            <View className="min-h-[40px] justify-center gap-0.5">{periodInner}</View>
          );
        })()}
      </View>

      {twrInline ? <View>{twrInline}</View> : null}

      <View style={{ gap: CHART_TIME_RANGE_GAP }}>
        {hasChart || chartLoading ? (
          <AreaChart
            key={chartRange}
            data={chartData}
            height={208}
            loading={chartLoading}
            valuePrefix={valuePrefix}
            showValueLabel={false}
            formatScrubDate={formatAnchorTime}
            onScrubChange={handleScrubChange}
            scrubValueSv={scrubValueSv}
            scrubActiveSv={scrubActiveSv}
          />
        ) : emptyChartMessage ? (
          <Text className={typographyClass("emptyMessage", "py-8")}>{emptyChartMessage}</Text>
        ) : null}

        {(hasChart || chartLoading) && (
          <TimeRangeSelector value={chartRange} onChange={onChartRangeChange} />
        )}
      </View>
    </View>
  );
}
