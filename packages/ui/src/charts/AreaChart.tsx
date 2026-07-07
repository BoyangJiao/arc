/**
 * AreaChart — @arc/ui wrapper over HeroUI Pro area-chart.
 *
 * Arc-owned: dot fill, stroke line, scrubber, period coloring (ADR 013).
 */

import "./ensure-chart-peers";

import type { ReactNode } from "react";
import { memo, useMemo } from "react";
import { View } from "react-native";
import { AreaChart as ProAreaChart } from "heroui-native-pro/area-chart";
import { LineChart as ProLineChart } from "heroui-native-pro/line-chart";
import type { SharedValue } from "react-native-reanimated";
import type { ChartBounds, PointsArray } from "victory-native";

import { ChartAreaDotFill } from "./ChartAreaDotFill";
import { HIDDEN_CARTESIAN_AXIS_PROPS } from "./chart-axis-props";
import { ChartPressOverlay, type NumericChartPressState } from "./ChartPressOverlay";
import { ChartDrawLoading } from "./ChartDrawLoading";
import { dotOpacityProfileForData } from "./chart-dot-opacity";
import { ensureRenderableChartPoints, toChartSeries } from "./chart-series";
import type { ChartPoint } from "./types";
import { useChartPeriodStrokeColor } from "./use-chart-period-stroke-color";
import type { ChartScrubState } from "../finance/chart-scrub";

export interface ArcAreaChartProps {
  readonly data: ReadonlyArray<ChartPoint>;
  readonly height?: number;
  readonly loading?: boolean;
  readonly valuePrefix?: string;
  readonly interactive?: boolean;
  readonly showStrokeLine?: boolean;
  readonly showValueLabel?: boolean;
  readonly formatScrubDate?: (isoTimestamp: string) => string;
  readonly onScrubChange?: (state: ChartScrubState | null) => void;
  /** UI-thread mirror of the current scrub price — bind to drive 60fps animations elsewhere. */
  readonly scrubValueSv?: SharedValue<number>;
  /** UI-thread mirror of whether the user is scrubbing. */
  readonly scrubActiveSv?: SharedValue<boolean>;
}

type SeriesRow = { index: number; value: number };

const heightClassFor = (height: number): string =>
  height >= 256 ? "h-64" : height >= 224 ? "h-56" : "h-48";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party chart compound API
const ProAreaChartRoot = ProAreaChart as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ProLineChartLine = ProLineChart.Line as any;

interface AreaChartCanvasProps {
  readonly series: ReadonlyArray<SeriesRow>;
  readonly strokeColor: string;
  readonly dotTopOpacity: number;
  readonly dotBottomOpacity: number;
  readonly heightClass: string;
  readonly showStrokeLine: boolean;
  readonly chartPressState?: NumericChartPressState;
  readonly onChartBoundsChange?: (bounds: ChartBounds) => void;
  readonly renderOverlays?: (chartBounds: ChartBounds) => ReactNode;
}

const AreaChartCanvas = memo(function AreaChartCanvas({
  series,
  strokeColor,
  dotTopOpacity,
  dotBottomOpacity,
  heightClass,
  showStrokeLine,
  chartPressState,
  onChartBoundsChange,
  renderOverlays,
}: AreaChartCanvasProps): ReactNode {
  const seriesKey = `${series.length}:${series[0]?.value ?? ""}:${series[series.length - 1]?.value ?? ""}`;

  return (
    <ProAreaChartRoot
      key={seriesKey}
      data={series}
      xKey="index"
      yKeys={["value"]}
      chartPressState={chartPressState}
      onChartBoundsChange={onChartBoundsChange}
      wrapperClassName={`w-full ${heightClass}`}
      {...HIDDEN_CARTESIAN_AXIS_PROPS}
    >
      {(args: { points: { value: PointsArray }; chartBounds: ChartBounds }) => (
        <>
          <ProAreaChart.Area points={args.points.value} y0={args.chartBounds.bottom} opacity={0} />
          <ChartAreaDotFill
            points={args.points.value}
            y0={args.chartBounds.bottom}
            color={strokeColor}
            left={args.chartBounds.left}
            right={args.chartBounds.right}
            top={args.chartBounds.top}
            bottom={args.chartBounds.bottom}
            topOpacity={dotTopOpacity}
            bottomOpacity={dotBottomOpacity}
          />
          {showStrokeLine ? (
            <ProLineChartLine points={args.points.value} color={strokeColor} curveType="linear" />
          ) : null}
          {renderOverlays?.(args.chartBounds)}
        </>
      )}
    </ProAreaChartRoot>
  );
});

export function AreaChart({
  data,
  height = 192,
  loading = false,
  valuePrefix = "",
  interactive = true,
  showStrokeLine = true,
  showValueLabel = true,
  formatScrubDate,
  onScrubChange,
  scrubValueSv,
  scrubActiveSv,
}: ArcAreaChartProps): ReactNode {
  const renderable = useMemo(() => ensureRenderableChartPoints(data), [data]);
  const series = useMemo((): SeriesRow[] => [...toChartSeries(renderable)], [renderable]);
  const strokeColor = useChartPeriodStrokeColor(renderable);
  const dotOpacity = useMemo(() => dotOpacityProfileForData(renderable), [renderable]);
  const scrubPoints = useMemo(
    () => renderable.map((p) => ({ asOf: p.asOf ?? p.label })),
    [renderable]
  );
  const scrubDateLabels = useMemo(() => {
    if (!formatScrubDate) return [];
    return renderable.map((p) => formatScrubDate(p.asOf ?? p.label ?? ""));
  }, [formatScrubDate, renderable]);

  if (loading) {
    return <ChartDrawLoading height={height} />;
  }

  if (series.length === 0) {
    return null;
  }

  const heightClass = heightClassFor(height);

  return (
    <View className="relative w-full">
      {interactive ? (
        <ChartPressOverlay
          height={height}
          valuePrefix={valuePrefix}
          indicatorColor={strokeColor}
          showValueLabel={showValueLabel}
          scrubPoints={scrubPoints}
          scrubDateLabels={scrubDateLabels}
          onScrubChange={onScrubChange}
          scrubValueSv={scrubValueSv}
          scrubActiveSv={scrubActiveSv}
        >
          {({ chartPressState, onChartBoundsChange, renderOverlays }) => (
            <AreaChartCanvas
              series={series}
              strokeColor={strokeColor}
              dotTopOpacity={dotOpacity.topOpacity}
              dotBottomOpacity={dotOpacity.bottomOpacity}
              heightClass={heightClass}
              showStrokeLine={showStrokeLine}
              chartPressState={chartPressState}
              onChartBoundsChange={onChartBoundsChange}
              renderOverlays={renderOverlays}
            />
          )}
        </ChartPressOverlay>
      ) : (
        <AreaChartCanvas
          series={series}
          strokeColor={strokeColor}
          dotTopOpacity={dotOpacity.topOpacity}
          dotBottomOpacity={dotOpacity.bottomOpacity}
          heightClass={heightClass}
          showStrokeLine={showStrokeLine}
        />
      )}
    </View>
  );
}
