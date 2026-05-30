/**
 * PortfolioInsightCard — the single unified per-portfolio card on the Insights
 * dashboard (Stage 3 Block B; consolidated from the old active-rebalance panel).
 *
 * Every portfolio renders identically: name (+active chip) → hero value + today →
 * TWR → drift donut + summary → full-width CTA (Acorns/Revolut). Detailed
 * per-asset drift bars live on the rebalance actions screen (drill-in).
 * Presentational — strings + signs resolved by the loader.
 */

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Button, Card, Chip, Text } from "../primitives";
import { useBusinessClasses } from "../tokens/business-context";
import {
  TYPO_CAPTION,
  TYPO_DISPLAY_2XL,
  TYPO_TITLE_LG,
  typographyClass,
} from "../tokens/typography";

import { DeviationDonut, type DeviationDonutProps } from "./DeviationDonut";
import { pnlTextClass, type PnlSign } from "./pnl-types";

export interface PortfolioInsightCardProps {
  readonly portfolioName: string;
  readonly reportingCurrency: string;
  readonly isActive?: boolean;
  readonly activeChipLabel?: string;
  readonly totalValueLabel: string;
  readonly todayChangeLabel: string;
  readonly todayChangeSign?: PnlSign;
  readonly deviationLabel: string;
  readonly rebalanceCountLabel: string;
  readonly hasTargets: boolean;
  readonly noTargetsTitle: string;
  readonly noTargetsCta: string;
  readonly viewActionsCta: string;
  readonly adjustTargetsCta: string;
  readonly targetSegments: DeviationDonutProps["targetSegments"];
  readonly currentSegments: DeviationDonutProps["currentSegments"];
  readonly onViewActionsPress: () => void;
  readonly onSetupTargetsPress: () => void;
  readonly isLoading?: boolean;
  readonly twrInline?: ReactNode;
}

export function PortfolioInsightCard({
  portfolioName,
  reportingCurrency,
  isActive = false,
  activeChipLabel,
  totalValueLabel,
  todayChangeLabel,
  todayChangeSign = "neutral",
  deviationLabel,
  rebalanceCountLabel,
  hasTargets,
  noTargetsTitle,
  noTargetsCta,
  viewActionsCta,
  adjustTargetsCta,
  targetSegments,
  currentSegments,
  onViewActionsPress,
  onSetupTargetsPress,
  isLoading = false,
  twrInline,
}: PortfolioInsightCardProps): ReactNode {
  const classes = useBusinessClasses();

  return (
    <Card>
      <View className="p-5 gap-5">
        {/* Identity */}
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Text className={TYPO_TITLE_LG} numberOfLines={1}>
              {portfolioName}
            </Text>
            {isActive && activeChipLabel ? (
              <Chip size="sm" variant="soft" color="success">
                <Chip.Label>{activeChipLabel}</Chip.Label>
              </Chip>
            ) : null}
          </View>
          <Text className={typographyClass("overline")}>{reportingCurrency}</Text>
        </View>

        {/* Hero value + today */}
        {isLoading ? (
          <Text className={`${TYPO_CAPTION} text-muted`}>{totalValueLabel}</Text>
        ) : (
          <View className="gap-1">
            <Text className={`${TYPO_DISPLAY_2XL} leading-none`}>{totalValueLabel}</Text>
            <Text className={typographyClass("caption", pnlTextClass(todayChangeSign, classes))}>
              {todayChangeLabel}
            </Text>
          </View>
        )}

        {twrInline ? <View>{twrInline}</View> : null}

        {hasTargets ? (
          <View className="gap-4">
            <DeviationDonut
              targetSegments={targetSegments}
              currentSegments={currentSegments}
              size={120}
            />
            <View className="gap-0.5">
              <Text className={`${TYPO_CAPTION} text-muted`}>{deviationLabel}</Text>
              <Text className={`${TYPO_CAPTION} text-muted`}>{rebalanceCountLabel}</Text>
            </View>
            <View className="gap-2">
              <Button onPress={onViewActionsPress}>
                <Button.Label>{viewActionsCta}</Button.Label>
              </Button>
              <Pressable
                accessibilityRole="button"
                onPress={onSetupTargetsPress}
                className="py-1 active:opacity-60"
              >
                <Text className={typographyClass("label", "text-muted", "text-center")}>
                  {adjustTargetsCta}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="gap-3">
            <Text className={`${TYPO_CAPTION} text-muted`}>{noTargetsTitle}</Text>
            <Button variant="secondary" onPress={onSetupTargetsPress}>
              <Button.Label>{noTargetsCta}</Button.Label>
            </Button>
          </View>
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
      <View className="p-5 gap-2">
        <View className="flex-row items-center gap-2">
          <Text className={typographyClass("overline")}>{title}</Text>
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>{badge}</Chip.Label>
          </Chip>
        </View>
        <Text className={`${TYPO_CAPTION} text-muted`}>{description}</Text>
      </View>
    </Card>
  );
}
