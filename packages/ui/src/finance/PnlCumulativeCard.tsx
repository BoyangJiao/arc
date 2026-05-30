/**
 * PnlCumulativeCard — 累计盈亏 card (Insights 盈亏分析, L3).
 *
 * Spec: pnl-analysis-insights §J18c / AC.2.2. Time-range INDEPENDENT: 持有收益 /
 * 总投入 / 现持市值. Mathematically closes with the Portfolio Tab holdings rows
 * (AC.1.1). Presentational — strings + sign resolved by the screen.
 */

import type { ReactNode } from "react";
import { View } from "react-native";

import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_LABEL, TYPO_METRIC_SM, typographyClass } from "../tokens/typography";

import { InfoTooltipButton } from "./InfoTooltipButton";
import { pnlTextClass, type PnlSign } from "./pnl-types";

export interface PnlCumulativeCardProps {
  readonly sectionTitle: string;
  readonly tooltip?: { readonly title: string; readonly body: string; readonly closeLabel: string };
  readonly holdingReturnLabel: string;
  /** Holding return % — e.g. "+47.57%"; omit when nothing invested. */
  readonly holdingReturnPercentLabel?: string;
  readonly holdingReturnSign: PnlSign;
  readonly holdingReturnLabelText: string;
  readonly totalInvestedLabelText: string;
  readonly totalInvestedValue: string;
  readonly totalValueLabelText: string;
  readonly totalValueValue: string;
}

export function PnlCumulativeCard(props: PnlCumulativeCardProps): ReactNode {
  const {
    sectionTitle,
    tooltip,
    holdingReturnLabel,
    holdingReturnPercentLabel,
    holdingReturnSign,
    holdingReturnLabelText,
    totalInvestedLabelText,
    totalInvestedValue,
    totalValueLabelText,
    totalValueValue,
  } = props;
  const classes = useBusinessClasses();
  const returnColor = pnlTextClass(holdingReturnSign, classes);

  return (
    <Card>
      <View className="p-5 gap-5">
        <View className="flex-row items-center gap-1.5">
          <Text className={typographyClass("overline")}>{sectionTitle}</Text>
          {tooltip ? (
            <InfoTooltipButton
              title={tooltip.title}
              body={tooltip.body}
              closeLabel={tooltip.closeLabel}
            />
          ) : null}
        </View>

        {/* Headline 持有收益 (range-independent). */}
        <View className="gap-1">
          <Text className={`${TYPO_CAPTION} text-muted`}>{holdingReturnLabelText}</Text>
          <View className="flex-row items-baseline gap-2">
            <Text className={typographyClass("metric", returnColor)}>{holdingReturnLabel}</Text>
            {holdingReturnPercentLabel ? (
              <Text className={typographyClass("rowValue", returnColor)}>
                {holdingReturnPercentLabel}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="gap-3.5">
          <View className="flex-row items-center justify-between">
            <Text className={`${TYPO_LABEL} text-muted`}>{totalInvestedLabelText}</Text>
            <Text className={TYPO_METRIC_SM}>{totalInvestedValue}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className={`${TYPO_LABEL} text-muted`}>{totalValueLabelText}</Text>
            <Text className={TYPO_METRIC_SM}>{totalValueValue}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}
