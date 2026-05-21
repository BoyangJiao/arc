/**
 * MarketChip — market selector / label chip (ADR 008 soft tint).
 */

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { RebalanceMarket } from "./rebalance-types";

import { Text } from "../primitives/Text";

export interface MarketChipProps {
  readonly market: RebalanceMarket;
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
}

export function MarketChip({
  market,
  label,
  selected = false,
  onPress,
}: MarketChipProps): ReactNode {
  const base = selected
    ? "bg-accent-soft border-accent-soft"
    : "bg-surface-secondary border-border";
  const text = selected ? "text-accent-soft-foreground font-medium" : "text-foreground";

  const inner = (
    <View className={`rounded-full px-3 py-1.5 border ${base}`}>
      <Text className={`text-xs ${text}`} accessibilityLabel={label}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) {
    return inner;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${market}`}
    >
      {inner}
    </Pressable>
  );
}
