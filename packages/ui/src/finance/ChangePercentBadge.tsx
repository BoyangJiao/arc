/**
 * ChangePercentBadge — price / period change percent with 红涨绿跌 colors.
 *
 * Label comes from `formatSignedPercent` when used standalone — no arrow prefix.
 * HeroUI TrendChip cannot express 红涨绿跌; this badge uses business palette instead.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import { typographyClass } from "../tokens/typography";

import { pnlSignFromDecimal } from "./trend-for-business";

export interface ChangePercentBadgeProps {
  readonly changePercent: Decimal;
  readonly formatPercent: (percent: Decimal) => string;
  readonly size?: "sm" | "md";
}

export function ChangePercentBadge({
  changePercent,
  formatPercent,
  size = "sm",
}: ChangePercentBadgeProps): ReactNode {
  const classes = useBusinessClasses();
  const sign = pnlSignFromDecimal(changePercent);
  const badgeRole = size === "sm" ? "badgeSm" : "badgeMd";
  const label = formatPercent(changePercent);

  if (sign === "neutral") {
    return (
      <View className="flex-row items-center px-2 py-0.5 rounded-full">
        <Text className={typographyClass(badgeRole, classes.pnlNeutral.text)}>{label}</Text>
      </View>
    );
  }

  const palette = sign === "gain" ? classes.gain : classes.loss;

  return (
    <View className={`flex-row items-center px-2 py-0.5 rounded-full ${palette.bgSoft}`}>
      <Text className={typographyClass(badgeRole, palette.textOnSoft)}>{label}</Text>
    </View>
  );
}
