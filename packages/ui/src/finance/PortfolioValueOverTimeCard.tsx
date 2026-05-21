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
        <Text className="text-foreground font-semibold">{title}</Text>
        <Text className="text-foreground text-2xl font-bold">{totalValueLabel}</Text>
        <Text className="text-muted text-xs">{disclaimer}</Text>
        <TimeRangeSelector value={range} onChange={onRangeChange} />
        {hasChart || loading ? (
          <AreaChart data={chartData} height={192} loading={loading} valuePrefix={valuePrefix} />
        ) : (
          <Text className="text-muted text-sm">{emptyMessage}</Text>
        )}
        <View className="flex-row justify-between">
          <View>
            <Text className="text-muted text-xs">{peakLabel}</Text>
            <Text className="text-foreground text-sm font-medium">{peakValue}</Text>
          </View>
          <View className="items-end">
            <Text className="text-muted text-xs">{troughLabel}</Text>
            <Text className="text-foreground text-sm font-medium">{troughValue}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}
