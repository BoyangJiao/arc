/**
 * HoldingsMarketFilter — multi-select market toggles for Portfolio Tab holdings list.
 *
 * Empty selection = show all markets (parent interprets empty Set as no filter).
 */

import type { ReactNode } from "react";
import { ScrollView } from "react-native";

import { ToggleButton, ToggleButtonGroup } from "../primitives-pro";
import { TYPO_CONTROL_LABEL } from "../tokens/typography";

import type { RebalanceMarket } from "./rebalance-types";

export interface HoldingsMarketFilterProps {
  /** Markets present in the portfolio (ordered). */
  readonly markets: readonly RebalanceMarket[];
  readonly labelFor: (market: RebalanceMarket) => string;
  readonly selectedMarkets: ReadonlySet<RebalanceMarket>;
  readonly onSelectedMarketsChange: (markets: Set<RebalanceMarket>) => void;
}

export function HoldingsMarketFilter({
  markets,
  labelFor,
  selectedMarkets,
  onSelectedMarketsChange,
}: HoldingsMarketFilterProps): ReactNode {
  if (markets.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <ToggleButtonGroup
        selectionMode="multiple"
        selectedKeys={selectedMarkets}
        onSelectionChange={(keys) =>
          onSelectedMarketsChange(new Set([...keys] as RebalanceMarket[]))
        }
        isDetached
        size="sm"
      >
        {markets.map((market) => (
          <ToggleButton key={market} id={market} size="sm">
            <ToggleButton.Label className={TYPO_CONTROL_LABEL}>
              {labelFor(market)}
            </ToggleButton.Label>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </ScrollView>
  );
}
