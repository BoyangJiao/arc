/**
 * ExposureSummaryTile — compact 2-up exposure entry (Delta-style, screenshot 1).
 *
 * Pro DonutChart + center top-slice %, title + optional tier badge inside the
 * card. Taps through to the full breakdown detail. Title sits inside the card
 * (compact metric-tile pattern), unlike full-width InsightSection sections.
 */

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { DonutChart, type DonutChartDatum } from "../charts";
import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { TYPO_CAPTION, TYPO_EMPTY_MESSAGE, TYPO_LABEL, TYPO_ROW_TITLE } from "../tokens/typography";

import { InsightTierBadge, type InsightTier } from "./InsightTierBadge";

export interface ExposureSummaryTileProps {
  readonly title: string;
  readonly tier?: InsightTier;
  readonly data: ReadonlyArray<DonutChartDatum>;
  /** Largest slice — shown in the donut center. */
  readonly topLabel?: string;
  readonly topPercent?: string;
  readonly emptyLabel?: string;
  /** Segmented-gap color — pass the card surface so gaps read as cuts. */
  readonly insetColor?: string;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
}

export function ExposureSummaryTile({
  title,
  tier = "free",
  data,
  topLabel,
  topPercent,
  emptyLabel,
  insetColor,
  onPress,
  accessibilityLabel,
}: ExposureSummaryTileProps): ReactNode {
  return (
    <Pressable
      className="flex-1 active:opacity-70"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <Card>
        <View className="gap-3">
          <View className="flex-row items-center gap-1.5">
            <Text className={TYPO_LABEL} numberOfLines={1}>
              {title}
            </Text>
            <InsightTierBadge tier={tier} />
          </View>
          {data.length === 0 ? (
            <Text className={TYPO_EMPTY_MESSAGE}>{emptyLabel}</Text>
          ) : (
            <DonutChart
              data={data}
              heightClass="h-32"
              innerRadius="72%"
              insetColor={insetColor}
              center={
                <View className="items-center px-2">
                  <Text className={TYPO_ROW_TITLE}>{topPercent}</Text>
                  <Text className={`${TYPO_CAPTION} text-muted`} numberOfLines={1}>
                    {topLabel}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Card>
    </Pressable>
  );
}
