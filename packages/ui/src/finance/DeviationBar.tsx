/**
 * DeviationBar — per-asset horizontal deviation indicator (Stage 2 J9).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";

import type { DeviationBarRow } from "./rebalance-types";

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

        const barWidth = Decimal.min(Decimal.max(row.currentPercent, 0), 100).toNumber();

        return (
          <View key={row.assetId} className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-sm font-medium">{row.label}</Text>
              <Text className={`text-sm font-semibold ${textClass}`}>
                {formatDeviation(row.deviationPercent)}
              </Text>
            </View>
            <View className={`h-2 rounded-full overflow-hidden ${tierClass}`}>
              <View
                className="h-full bg-foreground/20 rounded-full"
                style={{ width: `${barWidth}%` }}
              />
            </View>
            <Text className="text-muted text-xs">
              {formatPercent(row.currentPercent)} / {formatPercent(row.targetPercent)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
