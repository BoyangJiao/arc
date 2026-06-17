/**
 * PortfolioToggleGroup — single-select portfolio scope switcher for the Insights tab.
 *
 * Mirrors the holdings market filter (horizontal Pro ToggleButtonGroup), but
 * single-selection: picks WHICH portfolio's insights are shown. Renders nothing
 * when the user has fewer than 2 portfolios (no scope to switch).
 */

import type { ReactNode } from "react";
import { ScrollView } from "react-native";

import { ToggleButton, ToggleButtonGroup } from "../primitives-pro";
import { TYPO_CONTROL_LABEL } from "../tokens/typography";

export interface PortfolioToggleOption {
  readonly id: string;
  readonly name: string;
}

export interface PortfolioToggleGroupProps {
  readonly portfolios: readonly PortfolioToggleOption[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

export function PortfolioToggleGroup({
  portfolios,
  selectedId,
  onSelect,
}: PortfolioToggleGroupProps): ReactNode {
  if (portfolios.length < 2) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={selectedId ? new Set([selectedId]) : new Set()}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (typeof next === "string") onSelect(next);
        }}
        isDetached
        size="sm"
      >
        {portfolios.map((portfolio) => (
          <ToggleButton key={portfolio.id} id={portfolio.id} size="sm">
            <ToggleButton.Label className={TYPO_CONTROL_LABEL}>{portfolio.name}</ToggleButton.Label>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </ScrollView>
  );
}
