/**
 * DailySnapshotMoverRow — single asset row on daily P&L detail (ListGroup item body).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_SYMBOL, typographyClass } from "../tokens/typography";

import type { DailySnapshotAssetDelta } from "./DailySnapshotCard";

export interface DailySnapshotMoverRowProps {
  readonly mover: DailySnapshotAssetDelta;
  readonly formatAssetLabel: (assetId: string) => string;
  readonly formatAmount: (amount: Decimal) => string;
  readonly formatPercent: (percent: Decimal) => string;
  readonly accessibilityLabel?: string;
}

const signOf = (value: Decimal): "positive" | "negative" | "zero" => {
  if (value.isZero()) return "zero";
  return value.isNegative() ? "negative" : "positive";
};

export function DailySnapshotMoverRow({
  mover,
  formatAssetLabel,
  formatAmount,
  formatPercent,
  accessibilityLabel,
}: DailySnapshotMoverRowProps): ReactNode {
  const businessClasses = useBusinessClasses();
  const sign = signOf(mover.deltaPercent);
  const colorClass =
    sign === "positive"
      ? businessClasses.gain.text
      : sign === "negative"
        ? businessClasses.loss.text
        : businessClasses.pnlNeutral.text;

  return (
    <View
      className="flex-row items-center justify-between w-full gap-3"
      accessibilityLabel={accessibilityLabel}
    >
      <Text className={TYPO_SYMBOL} numberOfLines={1}>
        {formatAssetLabel(mover.assetId)}
      </Text>
      <View className="items-end gap-0.5 shrink-0">
        <Text className={typographyClass("metricSm", colorClass)}>
          {formatPercent(mover.deltaPercent)}
        </Text>
        <Text className={typographyClass("caption", "tabular-nums")}>
          {formatAmount(mover.deltaReporting)}
        </Text>
      </View>
    </View>
  );
}
