/**
 * CumulativeReturnChart — cost-basis cumulative return % curve (Insights 盈亏分析).
 *
 * Spec: .specify/feature-specs/stage-3/pnl-analysis-insights.md §UI (Commit 4).
 *
 * Differs from AreaChart (ADR 013):
 *   - curve is anchored so the first sample reads 0% (AC.1.5)
 *   - gradient/stroke colored by net period sign — reused for free from AreaChart's
 *     useChartPeriodStrokeColor (sign of last − first; first is 0 here) → AC.3.3
 *   - NO scrub (interactive=false) per §决策 10
 *
 * Design: Revolut/Wise-style — the line is the hero. We do NOT clutter it with
 * y-axis %% labels (the exact numbers live in the metric rows / headline); we
 * only draw a faint break-even baseline when the curve actually crosses 0%.
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { View } from "react-native";

import { AreaChart } from "./AreaChart";
import { buildPercentAxisModel, type PercentAxisInput } from "./chart-percent-axis";
import { Text } from "../primitives/Text";
import { typographyClass } from "../tokens/typography";

export interface ArcCumulativeReturnChartProps {
  readonly data: ReadonlyArray<PercentAxisInput>;
  readonly height?: number;
  readonly loading?: boolean;
  /** Shown when there is too little data to draw a curve (首日 (C) 用户). */
  readonly emptyLabel?: string;
}

export function CumulativeReturnChart({
  data,
  height = 160,
  loading = false,
  emptyLabel,
}: ArcCumulativeReturnChartProps): ReactNode {
  const model = useMemo(() => buildPercentAxisModel(data), [data]);

  if (!loading && !model.hasData) {
    return (
      <View className="items-center justify-center py-10" style={{ minHeight: height }}>
        <Text className={typographyClass("emptyMessage", "text-muted", "text-center")}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  // Break-even baseline only when the curve has both gains and losses vs start —
  // otherwise it sits flush against an edge and reads like a frame.
  const max = model.ticks[0]?.pct ?? 0;
  const min = model.ticks[model.ticks.length - 1]?.pct ?? 0;
  const zeroTick = model.ticks.find((t) => t.pct === 0);
  const showBaseline = !!zeroTick && max > 0 && min < 0;

  return (
    <View className="relative w-full" style={{ height }}>
      {showBaseline ? (
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 h-px bg-border/60"
          style={{ top: zeroTick!.topFraction * height }}
        />
      ) : null}
      <AreaChart data={model.points} height={height} loading={loading} interactive={false} />
    </View>
  );
}
