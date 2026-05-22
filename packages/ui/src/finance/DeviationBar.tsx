/**
 * DeviationBar — per-asset horizontal deviation indicator (Stage 2 J9).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_ROW_TITLE, typographyClass } from "../tokens/typography";

import type { DeviationBarRow } from "./rebalance-types";

/** RN needs explicit px height — Tailwind h-2 + h-full often fails on native. */
const TRACK_HEIGHT = 8;

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

  return (
    <View className="gap-3">
      {rows.map((row) => {
        const tierClass =
          row.tier === "critical"
            ? classes.deviationCritical.bgSoft
            : row.tier === "warning"
              ? classes.deviationWarning.bgSoft
              : "bg-surface-secondary";

        const textClass =
          row.tier === "critical"
            ? classes.deviationCritical.textOnSoft
            : row.tier === "warning"
              ? classes.deviationWarning.textOnSoft
              : classes.pnlNeutral.text;

        /** Bar fill = |deviation| magnitude (capped at 100), not current allocation %. */
        const barFill = Decimal.min(row.deviationPercent.abs(), 100).toNumber();

        return (
          <View key={row.assetId} className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className={TYPO_ROW_TITLE}>{row.label}</Text>
              <Text className={typographyClass("rowValue", textClass)}>
                {formatDeviation(row.deviationPercent)}
              </Text>
            </View>
            <View
              className={`rounded-full overflow-hidden ${tierClass}`}
              style={{ height: TRACK_HEIGHT }}
            >
              <View
                className="bg-foreground/20 rounded-full"
                style={{
                  height: TRACK_HEIGHT,
                  width: `${barFill}%`,
                }}
              />
            </View>
            <Text className={TYPO_CAPTION}>
              {formatPercent(row.currentPercent)} / {formatPercent(row.targetPercent)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
