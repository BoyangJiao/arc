/**
 * TwrInlineLabel — compact "{range} TWR：±X.XX%" with optional ⓘ explainer.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Skeleton, Text } from "../primitives";
import type { TimeRange } from "../charts/types";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_LABEL, typographyClass } from "../tokens/typography";

import { formatSignedPercent } from "./format-compact-change";
import { InfoTooltipButton } from "./InfoTooltipButton";
import { pnlSignFromDecimal } from "./trend-for-business";

export interface TwrInlineLabelResult {
  readonly value: Decimal;
}

export interface TwrInlineLabelProps {
  readonly range: TimeRange;
  readonly result?: TwrInlineLabelResult;
  readonly loading?: boolean;
  readonly unavailable?: string;
  readonly twrAbbrevLabel: string;
  readonly tooltipTitle: string;
  readonly tooltipBody: string;
  readonly closeLabel: string;
  /**
   * "compact" (default) — label + value on one line.
   * "prominent" — value in large bold text, label as caption below; ⓘ floats right.
   */
  readonly size?: "compact" | "prominent";
}

export function TwrInlineLabel({
  range,
  result,
  loading = false,
  unavailable = "—",
  twrAbbrevLabel,
  tooltipTitle,
  tooltipBody,
  closeLabel,
  size = "compact",
}: TwrInlineLabelProps): ReactNode {
  const classes = useBusinessClasses();

  const percentDisplay =
    result && !result.value.isNaN() ? formatSignedPercent(result.value.times(100)) : unavailable;

  const sign =
    result && !result.value.isNaN() ? pnlSignFromDecimal(result.value.times(100)) : "neutral";
  const valueColorClass =
    sign === "gain"
      ? classes.gain.text
      : sign === "loss"
        ? classes.loss.text
        : classes.pnlNeutral.text;

  const tooltipButton = (
    <InfoTooltipButton title={tooltipTitle} body={tooltipBody} closeLabel={closeLabel} />
  );

  if (size === "prominent") {
    return (
      <View className="flex-row items-start gap-1.5">
        <View className="flex-1 gap-0.5">
          {loading ? (
            <Skeleton className="h-7 w-28 rounded-md" />
          ) : (
            <Text className={typographyClass("display2xl", valueColorClass)}>{percentDisplay}</Text>
          )}
          <Text className={TYPO_CAPTION + " text-muted"}>{`${range} ${twrAbbrevLabel}`}</Text>
        </View>
        <View className="mt-1">{tooltipButton}</View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1.5">
      {loading ? (
        <Skeleton className="h-4 w-28 rounded-md" />
      ) : (
        <Text className={TYPO_LABEL}>
          <Text className="text-muted">{`${range} ${twrAbbrevLabel}：`}</Text>
          <Text className={typographyClass("rowValue", valueColorClass)}>{percentDisplay}</Text>
        </Text>
      )}
      {tooltipButton}
    </View>
  );
}
