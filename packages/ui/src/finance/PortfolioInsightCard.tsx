/**
 * CrossPortfolioRebalancePlaceholderCard — "coming later" teaser for cross-
 * portfolio rebalance on the Insights dashboard. (The per-portfolio 资产配置
 * section now renders as tiles via PortfolioAllocationSection in the app.)
 */

import type { ReactNode } from "react";
import { View } from "react-native";

import { Chip, Text } from "../primitives";
import { TYPO_CAPTION, typographyClass } from "../tokens/typography";

export interface CrossPortfolioRebalancePlaceholderCardProps {
  readonly title: string;
  readonly badge: string;
  readonly description: string;
}

export function CrossPortfolioRebalancePlaceholderCard({
  title,
  badge,
  description,
}: CrossPortfolioRebalancePlaceholderCardProps): ReactNode {
  return (
    <View className="gap-2 opacity-80">
      <View className="flex-row items-center gap-2">
        <Text className={typographyClass("overline")}>{title}</Text>
        <Chip size="sm" variant="soft" color="default">
          <Chip.Label>{badge}</Chip.Label>
        </Chip>
      </View>
      <Text className={`${TYPO_CAPTION} text-muted`}>{description}</Text>
    </View>
  );
}
