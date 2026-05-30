/**
 * RankingRow — single mover row in the 盈亏排行 card (Insights 盈亏分析, L2).
 *
 * Spec: pnl-analysis-insights §UI / 决策 6. Contribution amount colored by the
 * finance color mode; ratio (or 新建仓 badge) muted on the right. Tappable →
 * Asset Detail (AC.3.2).
 */

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_ROW_TITLE, typographyClass } from "../tokens/typography";

import { pnlTextClass, type PnlSign } from "./pnl-types";

export interface RankingRowProps {
  readonly name: string;
  /** Secondary identifier, e.g. "美股 · UBER". */
  readonly symbolLabel?: string;
  /** Signed contribution amount, e.g. "+¥18,400.00". */
  readonly contributionLabel: string;
  readonly sign: PnlSign;
  /** Ratio "+35.2%" or the 新建仓 badge label — rendered muted on the right. */
  readonly rightSubLabel?: string;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
}

export function RankingRow({
  name,
  symbolLabel,
  contributionLabel,
  sign,
  rightSubLabel,
  onPress,
  accessibilityLabel,
}: RankingRowProps): ReactNode {
  const classes = useBusinessClasses();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      onPress={onPress}
      className="flex-row items-center justify-between py-2.5 active:opacity-60"
    >
      <View className="flex-1 pr-3">
        <Text className={TYPO_ROW_TITLE} numberOfLines={1}>
          {name}
        </Text>
        {symbolLabel ? (
          <Text className={`${TYPO_CAPTION} text-muted`} numberOfLines={1}>
            {symbolLabel}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text className={typographyClass("rowValue", pnlTextClass(sign, classes))}>
          {contributionLabel}
        </Text>
        {rightSubLabel ? (
          <Text className={`${TYPO_CAPTION} text-muted`}>{rightSubLabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
