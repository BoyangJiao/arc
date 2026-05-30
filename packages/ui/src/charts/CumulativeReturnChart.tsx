/**
 * CumulativeReturnChart — cost-basis cumulative return % curve (Insights 盈亏分析).
 *
 * Spec: .specify/feature-specs/stage-3/pnl-analysis-insights.md §UI (Commit 4).
 *
 * Differs from AreaChart (ADR 013):
 *   - Y axis is `%` (not currency), anchored so the first sample reads 0% (AC.1.5)
 *   - reference-line ticks (max / 0% / min) overlaid via chart-percent-axis
 *   - gradient/stroke colored by net period sign — reused for free from AreaChart's
 *     useChartPeriodStrokeColor (sign of last − first; first is 0 here) → AC.3.3
 *   - NO scrub (interactive=false) per §决策 10
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { View } from "react-native";

import { AreaChart } from "./AreaChart";
import { buildPercentAxisModel, type PercentAxisInput } from "./chart-percent-axis";
import { Text } from "../primitives/Text";
import { TYPO_CAPTION, typographyClass } from "../tokens/typography";

export interface ArcCumulativeReturnChartProps {
  readonly data: ReadonlyArray<PercentAxisInput>;
  readonly height?: number;
  readonly loading?: boolean;
  /** Shown when there is too little data to draw a curve (首日 (C) 用户). */
  readonly emptyLabel?: string;
  /** Format a percent tick value → display string. Default `+12.3%` / `-4.0%`. */
  readonly formatPercent?: (pct: number) => string;
}

const defaultFormatPercent = (pct: number): string => {
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return "0%";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
};

export function CumulativeReturnChart({
  data,
  height = 192,
  loading = false,
  emptyLabel,
  formatPercent = defaultFormatPercent,
}: ArcCumulativeReturnChartProps): ReactNode {
  const model = useMemo(() => buildPercentAxisModel(data), [data]);

  if (!loading && !model.hasData) {
    return (
      <View className="items-center justify-center py-8" style={{ minHeight: height }}>
        <Text className={typographyClass("emptyMessage", "text-muted", "text-center")}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <View className="relative w-full" style={{ height }}>
      <AreaChart data={model.points} height={height} loading={loading} interactive={false} />
      {/* Percent reference lines + labels — non-interactive overlay. */}
      <View pointerEvents="none" className="absolute inset-0">
        {model.ticks.map((tick) => (
          <View
            key={tick.pct}
            className="absolute left-0 right-0 flex-row items-center"
            style={{ top: tick.topFraction * height }}
          >
            <View
              className={tick.pct === 0 ? "flex-1 h-px bg-border" : "flex-1 h-px bg-border/40"}
            />
            <Text className={`${TYPO_CAPTION} text-muted ml-1`}>{formatPercent(tick.pct)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
