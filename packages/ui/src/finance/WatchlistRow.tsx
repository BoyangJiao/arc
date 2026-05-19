/**
 * WatchlistRow — Stage 2 J8 presentational list row.
 *
 * Pure presentational: symbol / name / price / change% chip + optional stale dot.
 * Change % uses Pro TrendChip with finance color mode (S1-AC-5 / S2-AC-2.7).
 */

import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type Decimal from "decimal.js";

import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { TrendChip } from "../primitives-pro";
import { useFinanceColorMode } from "../tokens/business-context";

import { pnlSignFromDecimal, trendDirectionForPnL } from "./trend-for-business";

export interface WatchlistRowProps {
  readonly symbol: string;
  readonly name: string;
  /** Formatted price label (consumer supplies i18n + currency). */
  readonly priceLabel: string;
  readonly changePercent: Decimal | null;
  readonly stale?: boolean;
  readonly formatPercent: (percent: Decimal) => string;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
}

export function WatchlistRow(props: WatchlistRowProps): ReactNode {
  const {
    symbol,
    name,
    priceLabel,
    changePercent,
    stale = false,
    formatPercent,
    onPress,
    accessibilityLabel,
  } = props;

  const { financeColorMode } = useFinanceColorMode();

  const changeLabel = changePercent !== null ? formatPercent(changePercent) : "—";
  const trend =
    changePercent !== null
      ? trendDirectionForPnL(pnlSignFromDecimal(changePercent), financeColorMode)
      : "neutral";

  const content = (
    <Card>
      <View
        className="flex-row items-center px-3 py-3 gap-3"
        accessibilityLabel={accessibilityLabel ?? `${symbol} ${name}`}
      >
        <View className="flex-1 min-w-0">
          <Text className="text-foreground font-medium">{symbol}</Text>
          <Text className="text-muted text-xs" numberOfLines={1}>
            {name}
          </Text>
        </View>
        <View className="items-end shrink-0">
          <View className="flex-row items-center gap-1">
            <Text className="text-foreground text-sm font-medium">{priceLabel}</Text>
            {stale ? (
              <Text className="text-muted-foreground text-xs" accessibilityLabel="stale quote">
                ·
              </Text>
            ) : null}
          </View>
          {changePercent !== null ? (
            <TrendChip trend={trend} size="sm" variant="soft">
              {changeLabel}
            </TrendChip>
          ) : (
            <Text className="text-muted text-sm font-medium">{changeLabel}</Text>
          )}
        </View>
      </View>
    </Card>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return content;
}
