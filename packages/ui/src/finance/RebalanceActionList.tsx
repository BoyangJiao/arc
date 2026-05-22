/**
 * RebalanceActionList — flat list sorted by |amountNeeded| (spec §Resolved #5).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { TrendChip } from "../primitives-pro";
import { useFinanceColorMode } from "../tokens/business-context";
import { TYPO_BODY_SM, TYPO_CAPTION, TYPO_TITLE, typographyClass } from "../tokens/typography";

import { pnlSignFromDecimal, trendDirectionForPnL } from "./trend-for-business";
import type { RebalanceActionRow, RebalanceCurrency, RebalanceMarket } from "./rebalance-types";

export interface RebalanceActionListProps {
  readonly rows: ReadonlyArray<RebalanceActionRow>;
  readonly formatShares: (
    shares: Decimal,
    market: RebalanceMarket,
    nativeCurrency: RebalanceCurrency
  ) => string;
  readonly formatAmount: (amount: Decimal) => string;
  readonly amountEstimateLabel: string;
  readonly atTargetLabel: string;
  readonly disclaimer: string;
}

export function RebalanceActionList({
  rows,
  formatShares,
  formatAmount,
  amountEstimateLabel,
  atTargetLabel,
  disclaimer,
}: RebalanceActionListProps): ReactNode {
  const { financeColorMode } = useFinanceColorMode();

  const sorted = [...rows].sort((a, b) =>
    b.amountNeeded.abs().minus(a.amountNeeded.abs()).toNumber()
  );

  return (
    <View className="gap-4">
      {sorted.map((row) => {
        const atTarget = row.sharesNeeded.isZero();
        const businessSign = pnlSignFromDecimal(row.sharesNeeded);
        const trend = trendDirectionForPnL(businessSign, financeColorMode);
        const sharesLabel = formatShares(row.sharesNeeded, row.market, row.nativeCurrency);

        return (
          <View key={row.assetId} className="gap-2 py-3 border-b border-divider">
            <Text className={TYPO_TITLE}>{row.label}</Text>
            {atTarget ? (
              <Text className={TYPO_BODY_SM}>{atTargetLabel}</Text>
            ) : (
              <>
                <TrendChip trend={trend} size="md" variant="soft">
                  {sharesLabel}
                </TrendChip>
                <Text className={TYPO_BODY_SM}>
                  {amountEstimateLabel} {formatAmount(row.amountNeeded)}
                </Text>
                {row.market !== "CASH" && row.priceHint ? (
                  <Text className={TYPO_CAPTION}>{row.priceHint}</Text>
                ) : null}
              </>
            )}
          </View>
        );
      })}
      <Text className={typographyClass("disclaimer", "pt-2")}>{disclaimer}</Text>
    </View>
  );
}
