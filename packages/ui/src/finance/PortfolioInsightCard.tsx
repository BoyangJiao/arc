/**
 * PortfolioInsightCard — per-portfolio summary on Insights dashboard (Stage 3 Block B).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Card, Chip, Text } from "../primitives";
import { DeviationDonut, type DeviationDonutProps } from "./DeviationDonut";

export interface PortfolioInsightCardProps {
  readonly portfolioName: string;
  readonly reportingCurrency: string;
  readonly totalValueLabel: string;
  readonly todayChangeLabel: string;
  readonly deviationLabel: string;
  readonly rebalanceCountLabel: string;
  readonly hasTargets: boolean;
  readonly noTargetsTitle: string;
  readonly noTargetsCta: string;
  readonly viewCta: string;
  readonly targetSegments: DeviationDonutProps["targetSegments"];
  readonly currentSegments: DeviationDonutProps["currentSegments"];
  readonly onViewPress: () => void;
  readonly onSetupTargetsPress: () => void;
  readonly isLoading?: boolean;
}

export function PortfolioInsightCard({
  portfolioName,
  reportingCurrency,
  totalValueLabel,
  todayChangeLabel,
  deviationLabel,
  rebalanceCountLabel,
  hasTargets,
  noTargetsTitle,
  noTargetsCta,
  viewCta,
  targetSegments,
  currentSegments,
  onViewPress,
  onSetupTargetsPress,
  isLoading = false,
}: PortfolioInsightCardProps): ReactNode {
  return (
    <Card>
      <View className="p-4 gap-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-foreground font-semibold text-lg">{portfolioName}</Text>
            <Text className="text-muted text-xs">{reportingCurrency}</Text>
          </View>
          {hasTargets ? (
            <Button size="sm" variant="secondary" onPress={onViewPress}>
              <Button.Label>{viewCta}</Button.Label>
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onPress={onSetupTargetsPress}>
              <Button.Label>{noTargetsCta}</Button.Label>
            </Button>
          )}
        </View>

        {isLoading ? (
          <Text className="text-muted text-sm">{totalValueLabel}</Text>
        ) : (
          <>
            <Text className="text-foreground text-2xl font-bold">{totalValueLabel}</Text>
            <Text className="text-muted text-sm">{todayChangeLabel}</Text>
          </>
        )}

        {hasTargets ? (
          <>
            <DeviationDonut
              targetSegments={targetSegments}
              currentSegments={currentSegments}
              size={120}
            />
            <Text className="text-muted text-sm">{deviationLabel}</Text>
            <Text className="text-muted text-sm">{rebalanceCountLabel}</Text>
          </>
        ) : (
          <Text className="text-muted text-sm">{noTargetsTitle}</Text>
        )}
      </View>
    </Card>
  );
}

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
    <Card className="opacity-80">
      <View className="p-4 gap-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground font-semibold">{title}</Text>
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>{badge}</Chip.Label>
          </Chip>
        </View>
        <Text className="text-muted text-sm">{description}</Text>
      </View>
    </Card>
  );
}
