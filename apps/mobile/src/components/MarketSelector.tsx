/**
 * MarketSelector — horizontal market chips for tx entry (US/CN/HK/FUND/CRYPTO).
 */

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import type { Market } from "@arc/core";
import { MarketChip } from "@arc/ui";

const TX_MARKETS: readonly Market[] = ["US", "CN", "HK", "FUND", "CRYPTO"];

export interface MarketSelectorProps {
  readonly value: Market;
  readonly onChange: (market: Market) => void;
  readonly labelFor: (market: Market) => string;
}

export function MarketSelector({ value, onChange, labelFor }: MarketSelectorProps): ReactNode {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 py-1">
        {TX_MARKETS.map((market) => (
          <MarketChip
            key={market}
            market={market}
            label={labelFor(market)}
            selected={value === market}
            onPress={() => onChange(market)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
