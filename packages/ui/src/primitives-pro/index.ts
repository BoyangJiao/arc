/**
 * primitives-pro/ — HeroUI Native Pro 归位（ADR 006 §决策二 T0p）
 *
 * 当前: 薄 re-export。
 * License: 商业，仅限同公司主体内部使用。详见 ADR 006 §决策八。
 *
 * 按需打开（避免不必要的 peer 警告 / bundle 占用）：
 * - EmptyState: Markets / Insights 空态、其他 "coming soon" 场景
 * - DatePicker / DateRangePicker: 交易日期、Stage 2+ 报表区间
 * - NumberField / NumberStepper: 仅适合 number-safe 字段（注意 Decimal 边界）
 * - Segment: BUY/SELL/DIVIDEND/SPLIT 多类型切换（Stage 3）
 * - TrendChip / Badge: PnL 徽章 / 偏离度
 * - Calendar / RangeCalendar / DateField: 时间组件家族
 * - LineChart / AreaChart / BarChart / ChartCrosshair / ChartIndicator: 图表
 * - ProgressBar / ProgressButton / ProgressCircle / Stepper / RatingFamily: 进度 / 步骤
 * - Widget / SplitView: 复杂布局块
 *
 * Stage 1 仅打开真正使用到的：EmptyState (Markets/Insights), DatePicker (transactions/new)
 */

export { EmptyState } from "heroui-native-pro";
export { DatePicker } from "heroui-native-pro";
