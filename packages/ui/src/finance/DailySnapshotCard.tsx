/**
 * DailySnapshotCard — Stage 2 J7 "Daily Snapshot" presentational card.
 *
 * Pure presentational: receives a DailyDelta + format helpers, renders one
 * of 3 visible states (status='ok' | 'no-baseline' | 'empty-portfolio'
 * which is hidden). No data fetching, no global state — the consuming
 * page composes it with use-daily-delta (step 4).
 *
 * Color rules (per ADR 003 v3.1 + ADR 006 — Business tokens, not Foundation):
 *   - Positive delta: `useBusinessClasses().gain.text`
 *   - Negative delta: `useBusinessClasses().loss.text`
 *   - Zero / placeholder: `text-muted`
 * The toggle in Settings flips green↔red mapping automatically via
 * BusinessTokensProvider — this card is where S1-AC-5 (deferred from Stage 1)
 * gets visually verified.
 *
 * See .specify/feature-specs/daily-snapshot-stage-2.md §UI contract for
 * layout / states / interaction rules.
 */

import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type Decimal from "decimal.js";

import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";

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
  /** Delta result from `computeDailyDelta` in @arc/core */
  delta: DailySnapshotDelta;
  /** Title text e.g. "今日变动" / "Today's change" */
  title: string;
  /** Body for the no-baseline placeholder e.g. "首次启动，明日开始追踪每日变动" */
  noBaselineMessage: string;
  /** Disclaimer line e.g. "仅供参考，可能延迟" */
  disclaimer: string;
  /**
   * Format the total delta amount, e.g. (Decimal(352.20)) => "¥+352.20".
   * The sign prefix is the consumer's choice; ADR 006 keeps i18n + currency
   * concerns out of @arc/ui.
   */
  formatAmount: (amount: Decimal) => string;
  /** Format the percentage, e.g. (Decimal(1.23)) => "+1.23%". */
  formatPercent: (percent: Decimal) => string;
  /** Map assetId → display label (e.g. "US:AAPL" → "AAPL"). */
  formatAssetLabel: (assetId: string) => string;
  /** Called when a mover chip is tapped. Stage 2 callers should no-op (or log). */
  onMoverPress?: (assetId: string) => void;
  /** Max movers to display (default 3). */
  maxMovers?: number;
  /** Test-only label override for accessibility queries. */
  accessibilityLabel?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Sign helpers (avoid importing Decimal directly — duck-typed)

const signOf = (value: Decimal): "positive" | "negative" | "zero" => {
  if (value.isZero()) return "zero";
  return value.isNegative() ? "negative" : "positive";
};

// ──────────────────────────────────────────────────────────────────────────
// Component

export function DailySnapshotCard(props: DailySnapshotCardProps): ReactNode {
  const {
    delta,
    title,
    noBaselineMessage,
    disclaimer,
    formatAmount,
    formatPercent,
    formatAssetLabel,
    onMoverPress,
    maxMovers = 3,
    accessibilityLabel,
  } = props;

  // status='empty-portfolio' → don't render at all (consumer keeps space for
  // its own empty-state CTA)
  if (delta.status === "empty-portfolio") {
    return null;
  }

  const businessClasses = useBusinessClasses();

  // ── State: no-baseline (first day) ────────────────────────────────────
  if (delta.status === "no-baseline") {
    return (
      <Card>
        <View className="p-4 gap-2" accessibilityLabel={accessibilityLabel ?? title}>
          <Text className="text-muted text-sm">{title}</Text>
          <Text className="text-foreground text-base">{noBaselineMessage}</Text>
        </View>
      </Card>
    );
  }

  // ── State: ok ─────────────────────────────────────────────────────────
  const totalSign = signOf(delta.totalDeltaReporting);
  const totalColorClass =
    totalSign === "positive"
      ? businessClasses.gain.text
      : totalSign === "negative"
        ? businessClasses.loss.text
        : businessClasses.pnlNeutral.text;

  const visibleMovers = delta.movers.slice(0, maxMovers);

  return (
    <Card>
      <View className="p-4 gap-2" accessibilityLabel={accessibilityLabel ?? title}>
        <Text className="text-muted text-sm">{title}</Text>

        {/* Total — large, colored */}
        <Text className={`text-3xl font-bold ${totalColorClass}`}>
          {formatAmount(delta.totalDeltaReporting)}
        </Text>

        {/* Percent + disclaimer in one row */}
        <View className="flex-row items-baseline gap-2">
          <Text className={`text-base font-medium ${totalColorClass}`}>
            {formatPercent(delta.totalDeltaPercent)}
          </Text>
          <Text className="text-muted text-xs">· {disclaimer}</Text>
        </View>

        {/* Movers row */}
        {visibleMovers.length > 0 && (
          <View className="flex-row gap-2 mt-3">
            {visibleMovers.map((mover) => (
              <MoverChip
                key={mover.assetId}
                mover={mover}
                label={formatAssetLabel(mover.assetId)}
                formatPercent={formatPercent}
                onPress={onMoverPress}
                businessClasses={businessClasses}
              />
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MoverChip — one tap target per mover

interface MoverChipProps {
  mover: DailySnapshotAssetDelta;
  label: string;
  formatPercent: (percent: Decimal) => string;
  onPress?: (assetId: string) => void;
  businessClasses: ReturnType<typeof useBusinessClasses>;
}

function MoverChip({
  mover,
  label,
  formatPercent,
  onPress,
  businessClasses,
}: MoverChipProps): ReactNode {
  const sign = signOf(mover.deltaPercent);
  const colorClass =
    sign === "positive"
      ? businessClasses.gain.text
      : sign === "negative"
        ? businessClasses.loss.text
        : businessClasses.pnlNeutral.text;

  return (
    <Pressable
      onPress={() => onPress?.(mover.assetId)}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${formatPercent(mover.deltaPercent)}`}
      className="flex-1 bg-surface-secondary rounded-lg px-3 py-2 active:opacity-70"
    >
      <View className="gap-0.5">
        <Text className="text-foreground text-xs font-medium" numberOfLines={1}>
          {label}
        </Text>
        <Text className={`text-sm font-semibold ${colorClass}`} numberOfLines={1}>
          {formatPercent(mover.deltaPercent)}
        </Text>
      </View>
    </Pressable>
  );
}
