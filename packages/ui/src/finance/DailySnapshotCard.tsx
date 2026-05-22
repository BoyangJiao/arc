/**
 * DailySnapshotCard — Portfolio Tab daily P&L summary (outline / transparent).
 *
 * Layout mirrors compact insight cards (title → body → footer):
 * transparent fill, subtle border, tight padding.
 */

import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type Decimal from "decimal.js";

import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import {
  TYPO_BODY_SM,
  TYPO_CAPTION,
  TYPO_SNAPSHOT_CARD_TITLE,
  typographyClass,
} from "../tokens/typography";

// ──────────────────────────────────────────────────────────────────────────
// Public types — kept structurally compatible with @arc/core DailyDelta so
// the page can pass through without mapping. We avoid importing from
// @arc/core to keep packages/ui dep-free of domain logic (per ADR 006).

export interface DailySnapshotAssetDelta {
  readonly assetId: string;
  readonly deltaReporting: Decimal;
  readonly deltaPercent: Decimal;
  readonly currentValueReporting: Decimal;
}

export interface DailySnapshotDelta {
  readonly status: "ok" | "no-baseline" | "empty-portfolio";
  readonly totalDeltaReporting: Decimal;
  readonly totalDeltaPercent: Decimal;
  readonly movers: ReadonlyArray<DailySnapshotAssetDelta>;
  readonly baselineAsOf: string | null;
  readonly currentReportingCurrency: string;
}

export interface DailySnapshotCardProps {
  readonly delta: DailySnapshotDelta;
  readonly title: string;
  readonly noBaselineMessage: string;
  readonly formatChangeLine: (delta: Decimal, percent: Decimal | null) => string;
  readonly formatFooterDate: (isoTimestamp: string) => string;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
}

/** Outline shell — transparent bg, compact inset (参考「最新动态」卡片). */
const OUTLINE_FRAME = "rounded-2xl border border-border bg-transparent px-4 py-3 gap-1";

const signOf = (value: Decimal): "positive" | "negative" | "zero" => {
  if (value.isZero()) return "zero";
  return value.isNegative() ? "negative" : "positive";
};

function DailySnapshotCardFrame({
  children,
  accessibilityLabel,
}: {
  readonly children: ReactNode;
  readonly accessibilityLabel?: string;
}): ReactNode {
  return (
    <View className={OUTLINE_FRAME} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

export function DailySnapshotCard(props: DailySnapshotCardProps): ReactNode {
  const {
    delta,
    title,
    noBaselineMessage,
    formatChangeLine,
    formatFooterDate,
    onPress,
    accessibilityLabel,
  } = props;

  if (delta.status === "empty-portfolio") {
    return null;
  }

  const businessClasses = useBusinessClasses();

  if (delta.status === "no-baseline") {
    return (
      <DailySnapshotCardFrame accessibilityLabel={accessibilityLabel ?? title}>
        <Text className={TYPO_SNAPSHOT_CARD_TITLE}>{title}</Text>
        <Text className={TYPO_BODY_SM}>{noBaselineMessage}</Text>
      </DailySnapshotCardFrame>
    );
  }

  const totalSign = signOf(delta.totalDeltaReporting);
  const totalColorClass =
    totalSign === "positive"
      ? businessClasses.gain.text
      : totalSign === "negative"
        ? businessClasses.loss.text
        : businessClasses.pnlNeutral.text;

  const body = (
    <DailySnapshotCardFrame accessibilityLabel={accessibilityLabel ?? title}>
      <Text className={TYPO_SNAPSHOT_CARD_TITLE}>{title}</Text>
      <Text
        className={typographyClass("bodySm", "tabular-nums", totalColorClass)}
        numberOfLines={2}
      >
        {formatChangeLine(delta.totalDeltaReporting, delta.totalDeltaPercent)}
      </Text>
      {delta.baselineAsOf ? (
        <Text className={TYPO_CAPTION}>{formatFooterDate(delta.baselineAsOf)}</Text>
      ) : null}
    </DailySnapshotCardFrame>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      className="active:opacity-80"
    >
      {body}
    </Pressable>
  );
}
