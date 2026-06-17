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
 * Design (Revolut Performance): the line is the hero. A subtle right-axis shows
 * max / 0% / min as small muted tick labels, plus a faint break-even baseline at
 * 0% — scale cues without the heavy full-width gridlines.
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
  /** Enable Coinbase/Hero-style scrub (date anchor on drag). Default false. */
  readonly interactive?: boolean;
  /** Format the scrub anchor date (ISO → label); only used when interactive. */
  readonly formatScrubDate?: (isoTimestamp: string) => string;
}

const formatTick = (pct: number): string => {
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return "0%";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
};

const TICK_HALF_HEIGHT = 7;

export function CumulativeReturnChart({
  data,
  height = 160,
  loading = false,
  emptyLabel,
  interactive = false,
  formatScrubDate,
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

  const max = model.ticks[0]?.pct ?? 0;
  const min = model.ticks[model.ticks.length - 1]?.pct ?? 0;
  const zeroTick = model.ticks.find((t) => t.pct === 0);
  // Break-even baseline only when the curve has both gains and losses vs start —
  // otherwise it sits flush against an edge and reads like a frame.
  const showBaseline = !!zeroTick && max > 0 && min < 0;

  const clampTop = (topFraction: number): number =>
    Math.max(0, Math.min(height - TICK_HALF_HEIGHT * 2, topFraction * height - TICK_HALF_HEIGHT));

  return (
    <View className="relative w-full" style={{ height }}>
      {showBaseline ? (
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 h-px bg-border/60"
          style={{ top: zeroTick!.topFraction * height }}
        />
      ) : null}
      <AreaChart
        data={model.points}
        height={height}
        loading={loading}
        interactive={interactive}
        formatScrubDate={formatScrubDate}
      />
      {/* Subtle right-axis ticks — non-interactive overlay. */}
      <View pointerEvents="none" className="absolute inset-0">
        {model.ticks.map((tick) => (
          <Text
            key={tick.pct}
            className={`${TYPO_CAPTION} text-muted/70 absolute right-0 tabular-nums`}
            style={{ top: clampTop(tick.topFraction) }}
          >
            {formatTick(tick.pct)}
          </Text>
        ))}
      </View>
    </View>
  );
}
