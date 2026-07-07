/**
 * chart-palette — categorical 图表色板的单一来源
 *
 * SVG stroke/fill 不接受 Tailwind className，所以 chart 组件需要色值常量。
 * 2026-07 code review 前该色板在 AllocationDonut / DeviationDonut /
 * TargetAllocationForm 各存一份且顺序互不相同 —— 同一资产在再平衡流程的
 * setup 表单、偏离 donut、actions 页会拿到三种颜色。集中于此后按 index
 * 上色的所有消费方保持一致。
 *
 * 顺序即视觉语义：最大 slice 读作紫色（Delta-ordered:
 * purple → pink → yellow → blue → green → gray）。
 *
 * 注意：这是 chart 专用 categorical 色板，与涨跌语义色（business.ts）无关；
 * 涨跌色永远走 useBusinessClasses()。
 */

export const CHART_CATEGORICAL_PALETTE = [
  "#7828c8", // purple
  "#f31260", // pink
  "#f5a524", // yellow
  "#006fee", // blue
  "#17c964", // green
  "#71717a", // gray
] as const;

/** Color for the i-th categorical series (wraps around). */
export const chartCategoricalColor = (index: number): string =>
  CHART_CATEGORICAL_PALETTE[index % CHART_CATEGORICAL_PALETTE.length]!;
