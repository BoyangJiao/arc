/**
 * primitives-pro/ — HeroUI Native Pro 归位（ADR 006 §决策二 T0p）
 *
 * License: 商业，仅限同公司主体内部使用。详见 ADR 006 §决策八。
 *
 * ⚠️ Subpath 强制纪律（不要 `import { X } from "heroui-native-pro"`）：
 *   该包顶层 index.js 用 `export * from './components/...'` 重导出全部组件，
 *   Metro 会贪婪解析所有 transitive imports（即使我们只用 EmptyState）。
 *   chart-indicator 依赖 `@shopify/react-native-skia`（未装），结果整个 app
 *   bundle 失败。subpath import 只解析单个组件目录，避开 skia 副作用。
 *   2026-05-16 实测踩过这个坑。
 *
 * Phase 2 batch 1（2026-05-19, audit 后扩展）：
 *   按 .specify/feature-specs/cross-stage/component-audit.md §1.2 P0 列表开放。
 *   未启用项推迟到实际场景出现再加，避免无用的打包成本。
 *
 * 还未启用（按需）：
 * - DatePicker / DateRangePicker / Calendar / RangeCalendar / DateField — Stage 2 J11 CSV 导入
 * - ProgressBar / ProgressCircle — 再平衡执行进度（Stage 3）
 * - Stepper — 多步表单
 * - SlideButton — 危险操作确认（删除 portfolio 等）
 * - ToggleButtonGroup / ToggleButton — Portfolio Tab holdings market filter (Block C)
 * - LineChart / AreaChart / BarChart / ChartCrosshair / ChartIndicator — 需先装 skia
 */

export { EmptyState } from "heroui-native-pro/empty-state";
export { NumberField } from "heroui-native-pro/number-field";
export { NumberStepper } from "heroui-native-pro/number-stepper";
export { TrendChip } from "heroui-native-pro/trend-chip";
export { ProgressButton } from "heroui-native-pro/progress-button";
export { NumberValue } from "heroui-native-pro/number-value";
export { Widget } from "heroui-native-pro/widget";
export { Segment } from "heroui-native-pro/segment";
export { ToggleButton } from "heroui-native-pro/toggle-button";
export { ToggleButtonGroup } from "heroui-native-pro/toggle-button-group";
