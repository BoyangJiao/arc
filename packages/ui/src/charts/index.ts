/**
 * charts/ — HeroUI Pro chart wrappers (ADR 006 §决策树 case 6).
 *
 * Business code: `import { LineChart, AreaChart, TimeRangeSelector } from '@arc/ui'`.
 */

export { LineChart, type ArcLineChartProps, type ArcLineChartColor } from "./LineChart";
export { AreaChart, type ArcAreaChartProps } from "./AreaChart";
export {
  BarChart,
  type ArcBarChartProps,
  type ArcBarChartSeries,
  type ArcBarChartRow,
} from "./BarChart";
export { DonutChart, type DonutChartProps, type DonutChartDatum } from "./DonutChart";
export { MultiLineChart, type MultiLineChartProps, type MultiLineSeries } from "./MultiLineChart";
export { MultiLineScrubChart, type MultiLineScrubChartProps } from "./MultiLineScrubChart";
export { CumulativeReturnChart, type ArcCumulativeReturnChartProps } from "./CumulativeReturnChart";
export {
  buildPercentAxisModel,
  type PercentAxisInput,
  type PercentAxisTick,
  type PercentAxisModel,
} from "./chart-percent-axis";
export { ChartCrosshair } from "./ChartCrosshair";
export { ChartDrawLoading, type ChartDrawLoadingProps } from "./ChartDrawLoading";
export { ChartSkeleton, type ChartSkeletonProps } from "./ChartSkeleton";
export { TimeRangeSelector, type TimeRangeSelectorProps } from "./TimeRangeSelector";
export { CHART_TIME_RANGE_GAP } from "./chart-scrub-layout";
export { TIME_RANGE_OPTIONS, DEFAULT_TIME_RANGE, type TimeRange, type ChartPoint } from "./types";
export { decimateChartPoints, DEFAULT_CHART_DISPLAY_MAX_POINTS } from "./decimate-chart-points";
export type { ChartScrubState } from "../finance/chart-scrub";
