/**
 * HoldingRow — single holdings table row (dual-currency value display).
 */

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type Decimal from "decimal.js";

import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { TrendChip } from "../primitives-pro";
import { useFinanceColorMode } from "../tokens/business-context";

import { pnlSignFromDecimal, trendDirectionForPnL } from "./trend-for-business";

export interface HoldingRowProps {
  readonly symbol: string;
  readonly name: string;
  readonly sharesLabel: string;
  readonly priceLabel: string;
  readonly nativeValueLabel: string;
  readonly reportingValueLabel?: string;
  readonly changePercent: Decimal | null;
  readonly formatPercent: (percent: Decimal) => string;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
}

export function HoldingRow(props: HoldingRowProps): ReactNode {
  const {
    symbol,
    name,
    sharesLabel,
    priceLabel,
    nativeValueLabel,
    reportingValueLabel,
    changePercent,
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
          <Text className="text-muted text-xs mt-0.5">{sharesLabel}</Text>
        </View>
        <View className="items-end gap-0.5 shrink-0">
          <View className="flex-row items-center gap-2">
            <Text className="text-muted text-xs">{priceLabel}</Text>
            <TrendChip trend={trend} size="sm" variant="soft">
              {changeLabel}
            </TrendChip>
          </View>
          <Text className="text-foreground text-sm font-medium">{nativeValueLabel}</Text>
          {reportingValueLabel ? (
            <Text className="text-muted text-xs">{reportingValueLabel}</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}
