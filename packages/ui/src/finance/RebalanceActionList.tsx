/**
 * RebalanceActionList — flat list sorted by |amountNeeded| (spec §Resolved #5).
 *
 * Row (Wise/Revolut): leading AssetAvatar + name (left), buy/sell shares as a
 * colored TrendChip over the amount estimate (right). Price hint as a caption.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { AssetAvatar } from "./AssetAvatar";
import { Text } from "../primitives/Text";
import { TrendChip } from "../primitives-pro";
import { useFinanceColorMode } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_ROW_TITLE, typographyClass } from "../tokens/typography";

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
    <View className="gap-1">
      {sorted.map((row) => {
        const atTarget = row.sharesNeeded.isZero();
        const businessSign = pnlSignFromDecimal(row.sharesNeeded);
        const trend = trendDirectionForPnL(businessSign, financeColorMode);
        const sharesLabel = formatShares(row.sharesNeeded, row.market, row.nativeCurrency);

        return (
          <View key={row.assetId} className="flex-row items-center gap-3 py-3">
            <AssetAvatar
              symbol={row.symbol}
              market={row.market}
              marketLabel={row.marketLabel}
              imageUrl={row.imageUrl}
            />
            <View className="flex-1 min-w-0">
              <Text className={TYPO_ROW_TITLE} numberOfLines={1}>
                {row.label}
              </Text>
              {!atTarget && row.market !== "CASH" && row.priceHint ? (
                <Text className={`${TYPO_CAPTION} text-muted`} numberOfLines={1}>
                  {row.priceHint}
                </Text>
              ) : null}
            </View>
            {atTarget ? (
              <Text className={`${TYPO_CAPTION} text-muted`}>{atTargetLabel}</Text>
            ) : (
              <View className="items-end gap-1">
                <TrendChip trend={trend} size="md" variant="soft">
                  {sharesLabel}
                </TrendChip>
                <Text className={`${TYPO_CAPTION} text-muted`}>
                  {amountEstimateLabel} {formatAmount(row.amountNeeded)}
                </Text>
              </View>
            )}
          </View>
        );
      })}
      <Text className={typographyClass("disclaimer", "pt-3")}>{disclaimer}</Text>
    </View>
  );
}
