/**
 * WatchlistRow — Stage 2 J8 presentational list row.
 *
 * Pure presentational: symbol / name / price / change% as text (no chip).
 */

import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type Decimal from "decimal.js";

import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import {
  TYPO_BODY_MEDIUM,
  TYPO_CAPTION,
  TYPO_METRIC_SM,
  typographyClass,
} from "../tokens/typography";

import { pnlSignFromDecimal } from "./trend-for-business";

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

  const classes = useBusinessClasses();
  const changeLabel = changePercent !== null ? formatPercent(changePercent) : "—";
  const changeSign =
    changePercent !== null ? pnlSignFromDecimal(changePercent) : ("neutral" as const);
  const changeColorClass =
    changeSign === "gain"
      ? classes.gain.text
      : changeSign === "loss"
        ? classes.loss.text
        : classes.pnlNeutral.text;

  const content = (
    <Card>
      <View
        className="flex-row items-center gap-3"
        accessibilityLabel={accessibilityLabel ?? `${symbol} ${name}`}
      >
        <View className="flex-1 min-w-0">
          <Text className={TYPO_BODY_MEDIUM}>{symbol}</Text>
          <Text className={TYPO_CAPTION} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <View className="items-end shrink-0">
          <View className="flex-row items-center gap-1">
            <Text className={TYPO_METRIC_SM}>{priceLabel}</Text>
            {stale ? (
              <Text className={TYPO_CAPTION} accessibilityLabel="stale quote">
                ·
              </Text>
            ) : null}
          </View>
          <Text className={typographyClass("rowValue", changeColorClass)}>{changeLabel}</Text>
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
