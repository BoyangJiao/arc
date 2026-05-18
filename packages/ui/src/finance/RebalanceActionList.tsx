/**
 * RebalanceActionList — flat list sorted by |amountNeeded| (spec §Resolved #5).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";

import type { RebalanceActionRow } from "./rebalance-types";

export interface RebalanceActionListProps {
  readonly rows: ReadonlyArray<RebalanceActionRow>;
  readonly formatShares: (shares: Decimal, decimals: number) => string;
  readonly formatAmount: (amount: Decimal) => string;
  readonly sharesChangeLabel: string;
  readonly amountEstimateLabel: string;
  readonly atTargetLabel: string;
  readonly disclaimer: string;
}

export function RebalanceActionList({
  rows,
  formatShares,
  formatAmount,
  sharesChangeLabel,
  amountEstimateLabel,
  atTargetLabel,
  disclaimer,
}: RebalanceActionListProps): ReactNode {
  const classes = useBusinessClasses();

  const sorted = [...rows].sort((a, b) =>
    b.amountNeeded.abs().minus(a.amountNeeded.abs()).toNumber()
  );

  return (
    <View className="gap-4">
      {sorted.map((row) => {
        const atTarget = row.sharesNeeded.isZero();
        const sign = row.sharesNeeded.isPositive()
          ? "positive"
          : row.sharesNeeded.isNegative()
            ? "negative"
            : "zero";
        const colorClass =
          sign === "positive"
            ? classes.gain.text
            : sign === "negative"
              ? classes.loss.text
              : classes.pnlNeutral.text;

        return (
          <View key={row.assetId} className="gap-2 py-3 border-b border-divider">
            <Text className="text-foreground text-base font-semibold">{row.label}</Text>
            {atTarget ? (
              <Text className="text-muted text-sm">{atTargetLabel}</Text>
            ) : (
              <>
                <Text className="text-muted text-sm">{sharesChangeLabel}</Text>
                <Text className={`text-lg font-bold ${colorClass}`}>
                  {formatShares(row.sharesNeeded, row.shareDecimals)}
                </Text>
                <Text className="text-muted text-sm">
                  {amountEstimateLabel} {formatAmount(row.amountNeeded)}
                </Text>
                <Text className="text-muted text-xs">{row.priceHint}</Text>
              </>
            )}
          </View>
        );
      })}
      <Text className="text-muted text-xs pt-2">{disclaimer}</Text>
    </View>
  );
}
