/**
 * PortfolioValueOverTimeCard — cumulative NAV area chart + time range + peak/trough.
 *
 * @deprecated Use `PortfolioHeroSection` on Portfolio Tab (Block C UAT — no Card wrapper).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { AreaChart, TimeRangeSelector, type ChartPoint, type TimeRange } from "../charts";
import {
  TYPO_CAPTION,
  TYPO_DISPLAY_2XL,
  TYPO_DISCLAIMER,
  TYPO_LABEL,
  TYPO_METRIC_SM,
  TYPO_TITLE,
} from "../tokens/typography";

export interface PortfolioValueOverTimeCardProps {
  readonly title: string;
  readonly totalValueLabel: string;
  readonly peakLabel: string;
  readonly troughLabel: string;
  readonly peakValue: string;
  readonly troughValue: string;
  readonly disclaimer: string;
  readonly chartData: ReadonlyArray<ChartPoint>;
  readonly range: TimeRange;
  readonly onRangeChange: (range: TimeRange) => void;
  readonly loading?: boolean;
  readonly valuePrefix?: string;
  readonly emptyMessage?: string;
}

export function PortfolioValueOverTimeCard(props: PortfolioValueOverTimeCardProps): ReactNode {
  const {
    title,
    totalValueLabel,
    peakLabel,
    troughLabel,
    peakValue,
    troughValue,
    disclaimer,
    chartData,
    range,
    onRangeChange,
    loading = false,
    valuePrefix = "",
    emptyMessage,
  } = props;

  const hasChart = chartData.length > 0;

  return (
    <Card>
      <View className="p-4 gap-3">
        <Text className={TYPO_TITLE}>{title}</Text>
        <Text className={TYPO_DISPLAY_2XL}>{totalValueLabel}</Text>
        <Text className={TYPO_DISCLAIMER}>{disclaimer}</Text>
        <TimeRangeSelector value={range} onChange={onRangeChange} />
        {hasChart || loading ? (
          <AreaChart data={chartData} height={192} loading={loading} valuePrefix={valuePrefix} />
        ) : (
          <Text className={TYPO_LABEL}>{emptyMessage}</Text>
        )}
        <View className="flex-row justify-between">
          <View>
            <Text className={TYPO_CAPTION}>{peakLabel}</Text>
            <Text className={TYPO_METRIC_SM}>{peakValue}</Text>
          </View>
          <View className="items-end">
            <Text className={TYPO_CAPTION}>{troughLabel}</Text>
            <Text className={TYPO_METRIC_SM}>{troughValue}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}
