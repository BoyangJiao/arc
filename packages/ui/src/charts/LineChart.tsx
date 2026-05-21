/**
 * LineChart — @arc/ui wrapper over HeroUI Pro line-chart (ADR 006 charts/).
 *
 * Subpath import discipline: never import from `heroui-native-pro` top-level
 * (chart-indicator pulls skia into Metro bundle graph).
 */

import "./ensure-chart-peers";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { View } from "react-native";
import { LineChart as ProLineChart } from "heroui-native-pro/line-chart";
import type { ChartBounds, PointsArray } from "victory-native";

import { ChartPressOverlay, type NumericChartPressState } from "./ChartPressOverlay";
import { ChartSkeleton } from "./ChartSkeleton";
import { HIDDEN_CARTESIAN_AXIS_PROPS } from "./chart-axis-props";
import { ensureRenderableChartPoints, toChartSeries } from "./chart-series";
import type { ChartPoint } from "./types";
import { useChartPeriodStrokeColor } from "./use-chart-period-stroke-color";

export type ArcLineChartColor = "primary" | "secondary" | "tertiary";

export interface ArcLineChartProps {
  readonly data: ReadonlyArray<ChartPoint>;
  readonly color?: ArcLineChartColor;
  readonly height?: number;
  readonly loading?: boolean;
  readonly valuePrefix?: string;
  readonly interactive?: boolean;
}

type SeriesRow = { index: number; value: number };

const heightClassFor = (height: number): string =>
  height >= 256 ? "h-64" : height >= 224 ? "h-56" : "h-48";

/** HeroUI Pro chart generics omit yKeys inference — cast at wrapper boundary (ADR 006). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party chart compound API
const ProLineChartRoot = ProLineChart as any;

export function LineChart({
  data,
  height = 192,
  loading = false,
  valuePrefix = "",
  interactive = true,
}: ArcLineChartProps): ReactNode {
  const renderable = useMemo(() => ensureRenderableChartPoints(data), [data]);
  const series = useMemo((): SeriesRow[] => [...toChartSeries(renderable)], [renderable]);
  const strokeColor = useChartPeriodStrokeColor(renderable);

  if (series.length === 0) {
    return loading ? <ChartSkeleton height={height} /> : null;
  }

  const heightClass = heightClassFor(height);

  const chartBody = (press?: {
    chartPressState?: NumericChartPressState;
    onChartBoundsChange?: (bounds: ChartBounds) => void;
    renderOverlays?: (chartBounds: ChartBounds) => ReactNode;
  }) => (
    <ProLineChartRoot
      data={series}
      xKey="index"
      yKeys={["value"]}
      chartPressState={press?.chartPressState}
      onChartBoundsChange={press?.onChartBoundsChange}
      wrapperClassName={`w-full ${heightClass}`}
      {...HIDDEN_CARTESIAN_AXIS_PROPS}
    >
      {(args: { points: { value: PointsArray }; chartBounds: ChartBounds }) => (
        <>
          <ProLineChart.Line points={args.points.value} color={strokeColor} curveType="linear" />
          {press?.renderOverlays?.(args.chartBounds)}
        </>
      )}
    </ProLineChartRoot>
  );

  return (
    <View className="relative w-full">
      {interactive ? (
        <ChartPressOverlay height={height} valuePrefix={valuePrefix} indicatorColor={strokeColor}>
          {({ chartPressState, onChartBoundsChange, renderOverlays }) =>
            chartBody({ chartPressState, onChartBoundsChange, renderOverlays })
          }
        </ChartPressOverlay>
      ) : (
        chartBody()
      )}
      {loading ? (
        <View className="absolute inset-0 bg-background/80 justify-center">
          <ChartSkeleton height={height} />
        </View>
      ) : null}
    </View>
  );
}
