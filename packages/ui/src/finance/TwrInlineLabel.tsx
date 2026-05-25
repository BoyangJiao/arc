/**
 * TwrInlineLabel — compact "{range} TWR：±X.XX%" with optional ⓘ explainer.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type Decimal from "decimal.js";

import { Button, Dialog, Skeleton, Text } from "../primitives";
import type { TimeRange } from "../charts/types";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_LABEL, typographyClass } from "../tokens/typography";

import { formatSignedPercent } from "./format-compact-change";
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
}: TwrInlineLabelProps): ReactNode {
  const classes = useBusinessClasses();
  const [tooltipOpen, setTooltipOpen] = useState(false);

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

  return (
    <>
      <View className="flex-row items-center gap-1.5">
        {loading ? (
          <Skeleton className="h-4 w-28 rounded-md" />
        ) : (
          <Text className={TYPO_LABEL}>
            <Text className="text-muted">{`${range} ${twrAbbrevLabel}：`}</Text>
            <Text className={typographyClass("rowValue", valueColorClass)}>{percentDisplay}</Text>
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tooltipTitle}
          hitSlop={8}
          onPress={() => setTooltipOpen(true)}
        >
          <Text className={typographyClass("caption", "text-muted")}>ⓘ</Text>
        </Pressable>
      </View>

      <Dialog isOpen={tooltipOpen} onOpenChange={setTooltipOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>{tooltipTitle}</Dialog.Title>
            <Dialog.Description>
              <Text className={TYPO_CAPTION}>{tooltipBody}</Text>
            </Dialog.Description>
            <View className="mt-4">
              <Button variant="secondary" onPress={() => setTooltipOpen(false)}>
                <Button.Label>{closeLabel}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
