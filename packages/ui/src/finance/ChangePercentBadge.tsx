/**
 * ChangePercentBadge — daily price change with correct 红涨绿跌 colors + arrow direction.
 *
 * HeroUI TrendChip binds color to trend (up=green, down=red) and cannot express 红涨绿跌
 * with correct arrow direction. This badge decouples arrow (actual move) from color (user pref).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";

import { pnlSignFromDecimal } from "./trend-for-business";

export interface ChangePercentBadgeProps {
  readonly changePercent: Decimal;
  readonly formatPercent: (percent: Decimal) => string;
  readonly size?: "sm" | "md";
}

const arrowFor = (changePercent: Decimal): string => {
  if (changePercent.isZero()) return "";
  return changePercent.isPositive() ? "↑" : "↓";
};

export function ChangePercentBadge({
  changePercent,
  formatPercent,
  size = "sm",
}: ChangePercentBadgeProps): ReactNode {
  const classes = useBusinessClasses();
  const sign = pnlSignFromDecimal(changePercent);
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const label = `${arrowFor(changePercent)}${formatPercent(changePercent)}`;

  if (sign === "neutral") {
    return (
      <View className="flex-row items-center px-2 py-0.5 rounded-full">
        <Text className={`${textSize} font-medium tabular-nums ${classes.pnlNeutral.text}`}>
          {label}
        </Text>
      </View>
    );
  }

  const palette = sign === "gain" ? classes.gain : classes.loss;

  return (
    <View className={`flex-row items-center px-2 py-0.5 rounded-full ${palette.bgSoft}`}>
      <Text className={`${textSize} font-medium tabular-nums ${palette.textOnSoft}`}>{label}</Text>
    </View>
  );
}
