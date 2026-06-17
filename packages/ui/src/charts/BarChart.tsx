/**
 * BarChart — @arc/ui wrapper over HeroUI Pro bar-chart (ADR 006 charts/).
 *
 * 分类竖向柱状图：单序列（BarChart.Bar）或分组多序列（BarChart.BarGroup）。
 * 主要服务 Insights「组合 vs 基准」分组柱（insights-enrichment spec #9）。
 *
 * 注：PA 逐资产「水平 ± 发散条」（spec #8）更适合 View 版条形（参考 DeviationBar），
 * 不走 victory-native 横向柱；本组件专注竖向分类柱。
 *
 * Subpath import discipline: never import from `heroui-native-pro` top-level
 * (chart-indicator pulls skia into the Metro bundle graph).
 *
 * ⚠️ Skia chart — 视觉效果需在真机/模拟器复核（无法在静态环境渲染验证）。
 */

import "./ensure-chart-peers";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { View } from "react-native";
import { BarChart as ProBarChart } from "heroui-native-pro/bar-chart";
import type { ChartBounds, PointsArray } from "victory-native";

export type ArcBarChartRow = Record<string, number | string>;

export interface ArcBarChartSeries {
  /** data 行内的数值字段名（= yKey） */
  readonly key: string;
  /** 柱色 className；缺省按 Arc chart token（--chart-1..5）轮转 */
  readonly colorClassName?: string;
}

export interface ArcBarChartProps {
  readonly data: ReadonlyArray<ArcBarChartRow>;
  /** 分类轴字段名（如时段标签 1M/3M/YTD/1Y） */
  readonly xKey: string;
  /** 1 个 = 单序列柱；≥2 个 = 分组柱（如 组合 vs 基准） */
  readonly series: ReadonlyArray<ArcBarChartSeries>;
  readonly height?: number;
  readonly barWidth?: number;
}

/** 默认柱色轮转 — 复用 Arc chart token（apps/mobile/global.css --chart-1..5）。 */
const DEFAULT_BAR_COLORS = [
  "accent-chart-3",
  "accent-chart-1",
  "accent-chart-4",
  "accent-chart-2",
  "accent-chart-5",
] as const;

const ROUNDED_TOP = { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 } as const;

const heightClassFor = (height: number): string =>
  height >= 256 ? "h-64" : height >= 224 ? "h-56" : height >= 192 ? "h-48" : "h-40";

/** HeroUI Pro chart generics omit yKeys inference — cast at wrapper boundary (ADR 006). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party chart compound API
const ProBarChartRoot = ProBarChart as any;

export function BarChart({
  data,
  xKey,
  series,
  height = 192,
  barWidth = 12,
}: ArcBarChartProps): ReactNode {
  const yKeys = useMemo(() => series.map((s) => s.key), [series]);
  const tickValues = useMemo(() => Array.from({ length: data.length }, (_, i) => i), [data.length]);

  if (data.length === 0 || series.length === 0) return null;

  const colorFor = (index: number): string =>
    series[index]?.colorClassName ?? DEFAULT_BAR_COLORS[index % DEFAULT_BAR_COLORS.length]!;

  return (
    <View className="relative w-full">
      <ProBarChartRoot
        data={data}
        xKey={xKey}
        yKeys={yKeys}
        xAxis={{ tickValues }}
        wrapperClassName={`w-full ${heightClassFor(height)}`}
      >
        {(args: { points: Record<string, PointsArray>; chartBounds: ChartBounds }) =>
          series.length === 1 ? (
            <ProBarChart.Bar
              points={args.points[series[0]!.key]!}
              chartBounds={args.chartBounds}
              barWidth={barWidth}
              colorClassName={colorFor(0)}
              roundedCorners={ROUNDED_TOP}
            />
          ) : (
            <ProBarChart.BarGroup chartBounds={args.chartBounds} barWidth={barWidth}>
              {series.map((s, i) => (
                <ProBarChart.BarGroupItem
                  key={s.key}
                  points={args.points[s.key]!}
                  colorClassName={colorFor(i)}
                />
              ))}
            </ProBarChart.BarGroup>
          )
        }
      </ProBarChartRoot>
    </View>
  );
}
