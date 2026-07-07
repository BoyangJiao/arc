/**
 * Asset detail chart block — time range above plot, Apple Stocks scrub slot.
 */

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { AreaChart, type ChartPoint, type ChartScrubState, type TimeRange } from "@arc/ui";

import {
  ASSET_DETAIL_CHANGE_TO_TIME_RANGE_GAP,
  ASSET_DETAIL_CHART_HEIGHT,
  ASSET_DETAIL_TIME_RANGE_TO_CHART_GAP,
} from "../lib/asset-detail-chart-layout";
import {
  AssetDetailChartEmptyPlot,
  AssetDetailChartLoadingPlot,
  type AssetDetailChartPlotStatus,
} from "./AssetDetailChartEmptyPlot";
import { AssetDetailTimeRangeScrubSlot } from "./AssetDetailTimeRangeScrubSlot";

export type { AssetDetailChartPlotStatus };

export interface AssetDetailChartSectionProps {
  readonly range: TimeRange;
  readonly onRangeChange: (range: TimeRange) => void;
  readonly chartData: ReadonlyArray<ChartPoint>;
  readonly chartStatus: AssetDetailChartPlotStatus;
  readonly chartErrorTitle: string;
  readonly chartErrorDescription: string;
  readonly chartEmptyTitle: string;
  readonly chartEmptyDescription: string;
  readonly valuePrefix: string;
  readonly formatScrubDate: (isoTimestamp: string) => string;
  readonly onScrubbingChange?: (scrubbing: boolean) => void;
}

export function AssetDetailChartSection({
  range,
  onRangeChange,
  chartData,
  chartStatus,
  chartErrorTitle,
  chartErrorDescription,
  chartEmptyTitle,
  chartEmptyDescription,
  valuePrefix,
  formatScrubDate,
  onScrubbingChange,
}: AssetDetailChartSectionProps): ReactNode {
  const [scrub, setScrub] = useState<ChartScrubState | null>(null);
  const chartReady = chartStatus === "ready";

  useEffect(() => {
    setScrub(null);
  }, [chartData, range, chartStatus]);

  useEffect(() => {
    onScrubbingChange?.(scrub !== null);
  }, [scrub, onScrubbingChange]);

  const handleScrubChange = useCallback((next: ChartScrubState | null) => {
    setScrub((prev) => {
      if (next === null) return null;
      if (prev?.index === next.index && prev.value === next.value) return prev;
      return next;
    });
  }, []);

  const plot = (() => {
    if (chartStatus === "loading") {
      return <AssetDetailChartLoadingPlot />;
    }
    if (chartStatus === "error") {
      return (
        <AssetDetailChartEmptyPlot
          variant="error"
          title={chartErrorTitle}
          description={chartErrorDescription}
        />
      );
    }
    if (chartStatus === "empty") {
      return (
        <AssetDetailChartEmptyPlot
          variant="empty"
          title={chartEmptyTitle}
          description={chartEmptyDescription}
        />
      );
    }
    return (
      <AreaChart
        key={range}
        data={chartData}
        height={ASSET_DETAIL_CHART_HEIGHT}
        valuePrefix={valuePrefix}
        showValueLabel
        onScrubChange={handleScrubChange}
      />
    );
  })();

  return (
    <View style={{ marginTop: ASSET_DETAIL_CHANGE_TO_TIME_RANGE_GAP }}>
      <AssetDetailTimeRangeScrubSlot
        range={range}
        onRangeChange={onRangeChange}
        scrub={chartReady ? scrub : null}
        formatScrubDate={formatScrubDate}
      />
      <View style={{ height: ASSET_DETAIL_TIME_RANGE_TO_CHART_GAP }} />
      {plot}
    </View>
  );
}
