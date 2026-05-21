/**
 * DailyMoverChips — top daily-P&L contributors (Arc finance layer).
 */

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";

import type { DailySnapshotAssetDelta } from "./DailySnapshotCard";

export interface DailyMoverChipsProps {
  readonly movers: ReadonlyArray<DailySnapshotAssetDelta>;
  readonly formatPercent: (percent: Decimal) => string;
  readonly formatAssetLabel: (assetId: string) => string;
  readonly onMoverPress?: (assetId: string) => void;
  readonly maxMovers?: number;
}

const signOf = (value: Decimal): "positive" | "negative" | "zero" => {
  if (value.isZero()) return "zero";
  return value.isNegative() ? "negative" : "positive";
};

export function DailyMoverChips({
  movers,
  formatPercent,
  formatAssetLabel,
  onMoverPress,
  maxMovers = 2,
}: DailyMoverChipsProps): ReactNode {
  const businessClasses = useBusinessClasses();
  const visible = movers.slice(0, maxMovers);
  if (visible.length === 0) return null;

  return (
    <View className="flex-row gap-2">
      {visible.map((mover) => {
        const sign = signOf(mover.deltaPercent);
        const colorClass =
          sign === "positive"
            ? businessClasses.gain.text
            : sign === "negative"
              ? businessClasses.loss.text
              : businessClasses.pnlNeutral.text;

        return (
          <Pressable
            key={mover.assetId}
            onPress={() => onMoverPress?.(mover.assetId)}
            accessibilityRole="button"
            accessibilityLabel={`${formatAssetLabel(mover.assetId)} ${formatPercent(mover.deltaPercent)}`}
            className="flex-1 bg-surface-secondary rounded-lg px-3 py-2 active:opacity-70"
          >
            <View className="gap-0.5">
              <Text className="text-foreground text-xs font-medium" numberOfLines={1}>
                {formatAssetLabel(mover.assetId)}
              </Text>
              <Text className={`text-sm font-semibold ${colorClass}`} numberOfLines={1}>
                {formatPercent(mover.deltaPercent)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
