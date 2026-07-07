/**
 * MultiLineScrubChart — interactive multi-series line chart with scrub (ADR 006).
 *
 * Like MultiLineChart but press-and-scrub: a crosshair + a per-series indicator
 * dot track the touch; the active data index is emitted to the parent so it can
 * render a synced header legend (per-series value + date) — the Delta asset-value
 * pattern. Values are looked up by index in the parent (one number crosses the
 * JS bridge per frame, not every series value).
 *
 * Modeled on the proven single-series ChartPressOverlay scrub plumbing.
 *
 * Subpath import discipline: chart + crosshair/indicator come from their
 * heroui-native-pro subpaths, never the package top-level.
 *
 * ⚠️ Skia chart — 视觉/手势需在真机复核（无法静态渲染验证）。
 */

import "./ensure-chart-peers";

import { type ReactNode, useCallback, useMemo } from "react";
import { View } from "react-native";
import { LineChart as ProLineChart } from "heroui-native-pro/line-chart";
import { ChartCrosshair } from "heroui-native-pro/chart-crosshair";
import { ChartIndicator } from "heroui-native-pro/chart-indicator";
import { useChartPressState, type ChartBounds, type PointsArray } from "victory-native";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";

import { HIDDEN_CARTESIAN_AXIS_PROPS } from "./chart-axis-props";
import type { MultiLineSeries } from "./MultiLineChart";

export interface MultiLineScrubChartProps {
  /** Rows keyed by `index` (x) + one numeric field per series key. */
  readonly data: ReadonlyArray<Record<string, number>>;
  readonly series: ReadonlyArray<MultiLineSeries>;
  readonly heightClass?: string;
  /** Active data index while scrubbing, or `null` on release. */
  readonly onActiveIndexChange?: (index: number | null) => void;
}

// HeroUI Pro chart generics omit yKeys inference — cast at wrapper boundary (ADR 006).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party chart compound API
const ProLineChartRoot = ProLineChart as any;

const readPressNumber = (value: unknown): number => {
  "worklet";
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "get" in value) {
    return (value as { get: () => number }).get();
  }
  return 0;
};

export function MultiLineScrubChart({
  data,
  series,
  heightClass = "h-56",
  onActiveIndexChange,
}: MultiLineScrubChartProps): ReactNode {
  const yKeys = useMemo(() => series.map((s) => s.key), [series]);
  const initial = useMemo(
    () => ({ x: 0, y: Object.fromEntries(yKeys.map((k) => [k, 0])) }),
    [yKeys]
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic y-key press shape
  const { state, isActive } = useChartPressState(initial as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- y indexed by dynamic series key
  const pressY = state.y as Record<string, { position: any }>;

  const emit = useCallback(
    (index: number | null) => onActiveIndexChange?.(index),
    [onActiveIndexChange]
  );
  const clear = useCallback(() => emit(null), [emit]);

  useAnimatedReaction(
    () => {
      "worklet";
      return {
        active: state.isActive.value,
        index: Math.round(readPressNumber(state.x.value.value)),
      };
    },
    (current, previous) => {
      "worklet";
      if (!onActiveIndexChange) return;
      if (!current.active) {
        if (previous?.active) runOnJS(clear)();
        return;
      }
      if (previous?.active && previous.index === current.index) return;
      runOnJS(emit)(current.index);
    },
    [emit, clear]
  );

  if (data.length === 0 || series.length === 0) return null;

  return (
    <View className="relative w-full">
      <ProLineChartRoot
        data={data}
        xKey="index"
        yKeys={yKeys}
        chartPressState={state}
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
            {isActive ? (
              <>
                <ChartCrosshair
                  x={state.x.position}
                  top={args.chartBounds.top}
                  bottom={args.chartBounds.bottom}
                />
                {series.map((s) =>
                  pressY[s.key] ? (
                    <ChartIndicator
                      key={s.key}
                      x={state.x.position}
                      y={pressY[s.key]!.position}
                      innerColor={s.color}
                    />
                  ) : null
                )}
              </>
            ) : null}
          </>
        )}
      </ProLineChartRoot>
    </View>
  );
}
