/**
 * HoldingRow — single holdings list row (ListGroup item body).
 *
 * Left: avatar + symbol / name / position quantity.
 * Right: reporting-currency value + period change line (vs chart time range).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Skeleton } from "../primitives";
import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_METRIC, TYPO_SYMBOL, typographyClass } from "../tokens/typography";

import { AssetAvatar } from "./AssetAvatar";
import type { RebalanceMarket } from "./rebalance-types";
import { pnlSignFromDecimal } from "./trend-for-business";

export type HoldingPeriodChange =
  | { readonly kind: "ok"; readonly delta: Decimal; readonly percent: Decimal | null }
  | { readonly kind: "new-position" }
  | { readonly kind: "unavailable" };

export interface HoldingRowProps {
  readonly symbol: string;
  readonly name: string;
  readonly market: RebalanceMarket;
  readonly marketLabel: string;
  readonly imageUrl?: string | null;
  /** e.g. "5.00 股" / "0.01 BTC" */
  readonly positionLabel: string;
  readonly valueLabel: string;
  readonly valueLoading?: boolean;
  readonly periodChange: HoldingPeriodChange;
  readonly newPositionLabel: string;
  /** Same shape as PortfolioHeroSection — e.g. +¥1,000.00 (+13.17%) */
  readonly formatPeriodChangeLine: (delta: Decimal, percent: Decimal | null) => string;
  readonly accessibilityLabel?: string;
}

export function HoldingRow(props: HoldingRowProps): ReactNode {
  const {
    symbol,
    name,
    market,
    marketLabel,
    imageUrl,
    positionLabel,
    valueLabel,
    valueLoading = false,
    periodChange,
    newPositionLabel,
    formatPeriodChangeLine,
    accessibilityLabel,
  } = props;

  const classes = useBusinessClasses();
  const periodDelta = periodChange.kind === "ok" ? periodChange.delta : null;
  const periodSign = periodDelta !== null ? pnlSignFromDecimal(periodDelta) : "neutral";
  const periodColorClass =
    periodSign === "gain"
      ? classes.gain.text
      : periodSign === "loss"
        ? classes.loss.text
        : classes.pnlNeutral.text;

  return (
    <View className="flex-row items-center gap-3 w-full" accessibilityLabel={accessibilityLabel}>
      <AssetAvatar symbol={symbol} market={market} marketLabel={marketLabel} imageUrl={imageUrl} />
      <View className="flex-1 min-w-0">
        <Text className={TYPO_SYMBOL}>{symbol}</Text>
        <Text className={TYPO_CAPTION} numberOfLines={1}>
          {name}
        </Text>
        <Text className={typographyClass("caption", "mt-0.5 tabular-nums")}>{positionLabel}</Text>
      </View>
      <View className="items-end gap-1 shrink-0 min-w-[120px]">
        {valueLoading ? (
          <Skeleton className="h-5 w-24 rounded-md" />
        ) : (
          <Text className={TYPO_METRIC}>{valueLabel}</Text>
        )}
        <View className="min-h-[20px] justify-center">
          {periodChange.kind === "ok" ? (
            <Text className={typographyClass("changeAmount", periodColorClass)} numberOfLines={1}>
              {formatPeriodChangeLine(periodChange.delta, periodChange.percent)}
            </Text>
          ) : periodChange.kind === "new-position" ? (
            <Text className={TYPO_CAPTION}>{newPositionLabel}</Text>
          ) : valueLoading ? (
            <Skeleton className="h-4 w-16 rounded-md" />
          ) : (
            <Text className={TYPO_CAPTION}>—</Text>
          )}
        </View>
      </View>
    </View>
  );
}
