/**
 * PortfolioInsightCard — per-portfolio summary on Insights dashboard (Stage 3 Block B).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Card, Chip, Text } from "../primitives";
import {
  TYPO_CAPTION,
  TYPO_DISPLAY_2XL,
  TYPO_LABEL,
  TYPO_TITLE,
  TYPO_TITLE_LG,
} from "../tokens/typography";
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
  readonly twrInline?: ReactNode;
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
  twrInline,
}: PortfolioInsightCardProps): ReactNode {
  return (
    <Card>
      <View className="p-4 gap-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className={TYPO_TITLE_LG}>{portfolioName}</Text>
            <Text className={TYPO_CAPTION}>{reportingCurrency}</Text>
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
          <Text className={TYPO_LABEL}>{totalValueLabel}</Text>
        ) : (
          <>
            <Text className={TYPO_DISPLAY_2XL}>{totalValueLabel}</Text>
            <Text className={TYPO_LABEL}>{todayChangeLabel}</Text>
          </>
        )}

        {/* TWR is portfolio-wide — appears regardless of target setup (spec J15c). */}
        {twrInline ? <View>{twrInline}</View> : null}

        {hasTargets ? (
          <>
            <DeviationDonut
              targetSegments={targetSegments}
              currentSegments={currentSegments}
              size={120}
            />
            <Text className={TYPO_LABEL}>{deviationLabel}</Text>
            <Text className={TYPO_LABEL}>{rebalanceCountLabel}</Text>
          </>
        ) : (
          <Text className={TYPO_LABEL}>{noTargetsTitle}</Text>
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
          <Text className={TYPO_TITLE}>{title}</Text>
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>{badge}</Chip.Label>
          </Chip>
        </View>
        <Text className={TYPO_LABEL}>{description}</Text>
      </View>
    </Card>
  );
}
