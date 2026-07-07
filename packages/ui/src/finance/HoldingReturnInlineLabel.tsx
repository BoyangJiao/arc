/**
 * HoldingReturnInlineLabel — small "label  +¥3,500 (+23.5%)  ⓘ" line.
 *
 * Cost-basis holding return (incl. dividends; ADR 016 §决策 2/4). Rendered below the
 * prominent TWR on Asset Detail; gain/loss color follows business semantics.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Text } from "../primitives";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_LABEL, typographyClass } from "../tokens/typography";

import { formatCompactChangeLine } from "./format-compact-change";
import { InfoTooltipButton } from "./InfoTooltipButton";
import { pnlSignFromDecimal } from "./trend-for-business";

export interface HoldingReturnInlineLabelProps {
  readonly label: string;
  readonly amount: Decimal;
  readonly percent: Decimal | null;
  readonly currencySymbol: string;
  readonly redactAmount?: boolean;
  readonly tooltipTitle: string;
  readonly tooltipBody: string;
  readonly closeLabel: string;
}

export function HoldingReturnInlineLabel({
  label,
  amount,
  percent,
  currencySymbol,
  redactAmount = false,
  tooltipTitle,
  tooltipBody,
  closeLabel,
}: HoldingReturnInlineLabelProps): ReactNode {
  const classes = useBusinessClasses();

  const sign = pnlSignFromDecimal(amount);
  const valueColorClass =
    sign === "gain"
      ? classes.gain.text
      : sign === "loss"
        ? classes.loss.text
        : classes.pnlNeutral.text;

  const display = formatCompactChangeLine(amount, percent, currencySymbol, {
    redactAmount,
  });

  return (
    <View className="flex-row items-center gap-1.5">
      <Text className={TYPO_LABEL}>
        <Text className="text-muted">{`${label}：`}</Text>
        <Text className={typographyClass("rowValue", valueColorClass)}>{display}</Text>
      </Text>
      <InfoTooltipButton title={tooltipTitle} body={tooltipBody} closeLabel={closeLabel} />
    </View>
  );
}
