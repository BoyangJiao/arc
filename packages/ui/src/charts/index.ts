/**
 * charts/ — HeroUI Pro chart wrappers (ADR 006 §决策树 case 6).
 *
 * Business code: `import { LineChart, AreaChart, TimeRangeSelector } from '@arc/ui'`.
 */

export { LineChart, type ArcLineChartProps, type ArcLineChartColor } from "./LineChart";
export { AreaChart, type ArcAreaChartProps } from "./AreaChart";
export { ChartCrosshair } from "./ChartCrosshair";
export { TimeRangeSelector, type TimeRangeSelectorProps } from "./TimeRangeSelector";
export { TIME_RANGE_OPTIONS, DEFAULT_TIME_RANGE, type TimeRange, type ChartPoint } from "./types";
