/**
 * primitives-pro/ — HeroUI Native Pro 归位（ADR 006 §决策二 T0p）
 *
 * 当前: 薄 re-export，使用 **subpath imports**（heroui-native-pro/X 而不是
 *       从顶层 `import { X } from "heroui-native-pro"`）。
 * License: 商业，仅限同公司主体内部使用。详见 ADR 006 §决策八。
 *
 * ⚠️ Subpath 强制纪律 — 不要 `import { X } from "heroui-native-pro"` 写法：
 *   该包顶层 index.js 用 `export * from './components/...'` 重导出全部组件，
 *   Metro 会贪婪解析所有 transitive imports（即使我们只用 EmptyState）。
 *   chart-indicator 依赖 `@shopify/react-native-skia`（未装），结果整个 app
 *   bundle 失败。subpath import (`heroui-native-pro/empty-state`) 只解析单个
 *   组件目录，避开 chart-indicator 副作用。2026-05-16 实测踩过这个坑。
 *
 * 按需打开（添加新组件时同样用 subpath，避免重新打开 skia 坑）：
 * - EmptyState: Markets / Insights 空态、其他 "coming soon" 场景
 * - DatePicker / DateRangePicker: 交易日期、Stage 2+ 报表区间
 * - NumberField / NumberStepper: 仅适合 number-safe 字段（注意 Decimal 边界）
 * - Segment: BUY/SELL/DIVIDEND/SPLIT 多类型切换（Stage 3）
 * - TrendChip / Badge: PnL 徽章 / 偏离度
 * - Calendar / RangeCalendar / DateField: 时间组件家族
 * - LineChart / AreaChart / BarChart / ChartCrosshair / ChartIndicator: 图表
 *   ↑ 这些需要 @shopify/react-native-skia；Stage 2 接图表时再装
 * - ProgressBar / ProgressButton / ProgressCircle / Stepper / RatingFamily: 进度 / 步骤
 * - Widget / SplitView: 复杂布局块
 *
 * Stage 1 仅打开真正使用到的：EmptyState (Markets/Insights)。
 * DatePicker 推到 Stage 2 与 CSV 导入一起做（Fix 6 commit message 已说明）。
 */

export { EmptyState } from "heroui-native-pro/empty-state";
