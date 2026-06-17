/**
 * DeviationBar — per-asset diverging deviation indicator (Stage 2 J9; J-Insights polish).
 *
 * Center-zero diverging bar: a fixed 0 baseline runs down the middle; a bar grows
 * LEFT for under-allocation (current < target) and RIGHT for over-allocation
 * (current > target). Bar length is the deviation magnitude scaled to the largest
 * drift in the set (so the worst offender fills its half and the rest read
 * proportionally), and the fill color encodes severity tier. Direction + length +
 * color let the user feel "which asset drifted, which way, how far" at a glance —
 * what a composition donut cannot show.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_ROW_TITLE, typographyClass } from "../tokens/typography";

import type { DeviationBarRow } from "./rebalance-types";

/** RN needs explicit px height — Tailwind h-2 + h-full often fails on native. */
const TRACK_HEIGHT = 10;
/** Smallest scale denominator — keeps near-target rows visually short. */
const MIN_SCALE = 8;

export interface DeviationBarProps {
  readonly rows: ReadonlyArray<DeviationBarRow>;
  readonly formatPercent: (value: Decimal) => string;
  readonly formatDeviation: (value: Decimal) => string;
}

export function DeviationBar({
  rows,
  formatPercent,
  formatDeviation,
}: DeviationBarProps): ReactNode {
  const classes = useBusinessClasses();

  // Scale to the largest drift in the set (floored), so magnitudes read relatively.
  const maxAbs = rows.reduce(
    (max, r) => Decimal.max(max, r.deviationPercent.abs()),
    new Decimal(MIN_SCALE)
  );

  return (
    <View className="gap-3.5">
      {rows.map((row) => {
        const fillClass =
          row.tier === "critical"
            ? classes.deviationCritical.bg
            : row.tier === "warning"
              ? classes.deviationWarning.bg
              : "bg-foreground/30";

        const textClass =
          row.tier === "critical"
            ? classes.deviationCritical.textOnSoft
            : row.tier === "warning"
              ? classes.deviationWarning.textOnSoft
              : classes.pnlNeutral.text;

        const isOver = row.deviationPercent.isPositive();
        // Half-track fraction (0..1) → percent of the FULL track width (each half = 50%).
        const halfPct = Decimal.min(row.deviationPercent.abs().div(maxAbs), 1).times(50).toNumber();

        return (
          <View key={row.assetId} className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className={TYPO_ROW_TITLE}>{row.label}</Text>
              <Text
                className={typographyClass("rowValue", `${textClass} font-semibold tabular-nums`)}
              >
                {formatDeviation(row.deviationPercent)}
              </Text>
            </View>
            <View
              className="rounded-full bg-surface-secondary relative"
              style={{ height: TRACK_HEIGHT }}
            >
              <View
                className={`absolute rounded-full ${fillClass}`}
                style={{
                  height: TRACK_HEIGHT,
                  width: `${halfPct}%`,
                  ...(isOver ? { left: "50%" } : { right: "50%" }),
                }}
              />
              {/* 0 baseline tick — drawn last so it stays visible over the fill. */}
              <View
                className="absolute bg-border"
                style={{ width: 2, left: "50%", marginLeft: -1, top: -2, bottom: -2 }}
              />
            </View>
            <Text className={`${TYPO_CAPTION} tabular-nums`}>
              {formatPercent(row.currentPercent)} / {formatPercent(row.targetPercent)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
