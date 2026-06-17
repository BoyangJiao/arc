/**
 * MultiLineChart — @arc/ui wrapper over HeroUI Pro line-chart, multi-series
 * (ADR 006 charts/). Plots several lines (e.g. per-asset value over time) with a
 * color legend below. Non-interactive (overview chart). Colors are caller-supplied.
 *
 * Subpath import discipline: import from the `line-chart` subpath, never the
 * `heroui-native-pro` top-level.
 *
 * ⚠️ Skia chart — 视觉需在真机/模拟器复核。
 */

import "./ensure-chart-peers";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { View } from "react-native";
import { LineChart as ProLineChart } from "heroui-native-pro/line-chart";
import type { ChartBounds, PointsArray } from "victory-native";

import { Text } from "../primitives/Text";
import { TYPO_CAPTION_FOREGROUND } from "../tokens/typography";
import { HIDDEN_CARTESIAN_AXIS_PROPS } from "./chart-axis-props";

export interface MultiLineSeries {
  /** Field name in each data row (must be a safe object key). */
  readonly key: string;
  readonly label: string;
  /** Line color (hex). */
  readonly color: string;
}

export interface MultiLineChartProps {
  /** Rows keyed by `index` (x) + one numeric field per series key. */
  readonly data: ReadonlyArray<Record<string, number>>;
  readonly series: ReadonlyArray<MultiLineSeries>;
  /** Standard Tailwind height class (default `h-56`). */
  readonly heightClass?: string;
}

// HeroUI Pro chart generics omit yKeys inference — cast at wrapper boundary (ADR 006).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party chart compound API
const ProLineChartRoot = ProLineChart as any;

export function MultiLineChart({
  data,
  series,
  heightClass = "h-56",
}: MultiLineChartProps): ReactNode {
  const yKeys = useMemo(() => series.map((s) => s.key), [series]);

  if (data.length === 0 || series.length === 0) return null;

  return (
    <View className="w-full gap-3">
      <View className="relative w-full">
        <ProLineChartRoot
          data={data}
          xKey="index"
          yKeys={yKeys}
          wrapperClassName={`w-full ${heightClass}`}
          {...HIDDEN_CARTESIAN_AXIS_PROPS}
        >
          {(args: { points: Record<string, PointsArray>; chartBounds: ChartBounds }) => (
            <>
              {series.map((s) => (
                <ProLineChart.Line
                  key={s.key}
                  points={args.points[s.key]!}
                  color={s.color}
                  curveType="linear"
                />
              ))}
            </>
          )}
        </ProLineChartRoot>
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <View key={s.key} className="flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <Text className={TYPO_CAPTION_FOREGROUND} numberOfLines={1}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
