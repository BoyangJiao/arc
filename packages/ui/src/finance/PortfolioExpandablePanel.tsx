/**
 * PortfolioExpandablePanel — collapsible holdings tray on the Portfolio tab (crypto-wallet handle pattern).
 *
 * Collapsed: pill handle only. Expanded: active portfolio summary + holdings rows.
 * Multi-portfolio switcher UI lands in Stage 3; this component accepts portfolio rows for future use.
 */

import { type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { CaretRightIcon } from "../wrappers/icons";
import { ThemedIcon } from "../wrappers/themed-icon";
import {
  TYPO_BODY_MEDIUM,
  TYPO_CAPTION,
  TYPO_LABEL,
  TYPO_METRIC_SM,
  TYPO_OVERLINE,
} from "../tokens/typography";

export interface PortfolioExpandableHoldingRow {
  readonly id: string;
  readonly symbol: string;
  readonly subtitle?: string;
  readonly valueLabel: string;
  readonly onPress?: () => void;
}

export interface PortfolioExpandablePortfolioRow {
  readonly id: string;
  readonly name: string;
  readonly summaryLabel: string;
  readonly isActive?: boolean;
  readonly onPress?: () => void;
}

export interface PortfolioExpandablePanelProps {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly expandAccessibilityLabel: string;
  readonly collapseAccessibilityLabel: string;
  readonly holdingsTitle: string;
  readonly emptyHoldingsLabel: string;
  readonly portfolios?: readonly PortfolioExpandablePortfolioRow[];
  readonly holdings: readonly PortfolioExpandableHoldingRow[];
}

export function PortfolioExpandablePanel(props: PortfolioExpandablePanelProps): ReactNode {
  const {
    expanded,
    onToggle,
    expandAccessibilityLabel,
    collapseAccessibilityLabel,
    holdingsTitle,
    emptyHoldingsLabel,
    portfolios = [],
    holdings,
  } = props;

  return (
    <View className="gap-2">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? collapseAccessibilityLabel : expandAccessibilityLabel}
        className="items-center py-1 active:opacity-80"
      >
        <View className="h-1 w-10 rounded-full bg-muted" />
      </Pressable>

      {expanded ? (
        <Card>
          <View className="gap-3">
            {portfolios.length > 0 ? (
              <View className="gap-2">
                {portfolios.map((portfolio) => (
                  <Pressable
                    key={portfolio.id}
                    onPress={portfolio.onPress}
                    disabled={!portfolio.onPress}
                    accessibilityRole={portfolio.onPress ? "button" : undefined}
                    className="flex-row items-center justify-between rounded-xl bg-surface-secondary px-3 py-2.5 active:opacity-80"
                  >
                    <View className="flex-1 min-w-0 pr-2">
                      <Text className={TYPO_BODY_MEDIUM} numberOfLines={1}>
                        {portfolio.name}
                      </Text>
                      <Text className={TYPO_CAPTION} numberOfLines={1}>
                        {portfolio.summaryLabel}
                      </Text>
                    </View>
                    {portfolio.onPress ? (
                      <ThemedIcon icon={CaretRightIcon} size={18} colorToken="muted" />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View className="gap-2">
              <Text className={TYPO_OVERLINE}>{holdingsTitle}</Text>
              {holdings.length === 0 ? (
                <Text className={TYPO_LABEL}>{emptyHoldingsLabel}</Text>
              ) : (
                holdings.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={row.onPress}
                    disabled={!row.onPress}
                    accessibilityRole={row.onPress ? "button" : undefined}
                    className="flex-row items-center justify-between py-1 active:opacity-80"
                  >
                    <View className="flex-1 min-w-0 pr-3">
                      <Text className={TYPO_BODY_MEDIUM}>{row.symbol}</Text>
                      {row.subtitle ? (
                        <Text className={TYPO_CAPTION} numberOfLines={1}>
                          {row.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Text className={`${TYPO_METRIC_SM} shrink-0`}>{row.valueLabel}</Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>
        </Card>
      ) : null}
    </View>
  );
}
