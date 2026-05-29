/**
 * DailySnapshotDetailView — daily P&L detail body (summary + full mover list).
 */

import type { ReactNode } from "react";
import { Fragment } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { ListGroup, PressableFeedback, Separator } from "../primitives";
import { Text } from "../primitives/Text";
import { useBusinessClasses } from "../tokens/business-context";
import {
  TYPO_CAPTION,
  TYPO_DISCLAIMER,
  TYPO_SECTION_TITLE,
  TYPO_SNAPSHOT_CARD_TITLE,
  typographyClass,
} from "../tokens/typography";

import type { DailySnapshotDelta } from "./DailySnapshotCard";
import { DailySnapshotMoverRow } from "./DailySnapshotMoverRow";
import {
  shouldShowAllNewPositionsHeadline,
  visibleDailySnapshotMovers,
} from "./daily-snapshot-headline";

export interface DailySnapshotDetailViewProps {
  readonly delta: DailySnapshotDelta;
  readonly title: string;
  readonly noBaselineMessage: string;
  readonly moversSectionTitle: string;
  readonly disclaimer: string;
  readonly formatChangeLine: (delta: Decimal, percent: Decimal | null) => string;
  readonly formatAmount: (amount: Decimal) => string;
  readonly formatPercent: (percent: Decimal) => string;
  readonly formatAssetLabel: (assetId: string) => string;
  readonly formatFooterDate: (isoTimestamp: string) => string;
  /** e.g. "对比自 3 天前" — omit when baseline is yesterday. */
  readonly staleBaselineLabel?: string;
  /** When filter/scope has no overnight movers — e.g. all positions opened today. */
  readonly allNewPositionsMessage: string;
  readonly onMoverPress?: (assetId: string) => void;
}

const signOf = (value: Decimal): "positive" | "negative" | "zero" => {
  if (value.isZero()) return "zero";
  return value.isNegative() ? "negative" : "positive";
};

export function DailySnapshotDetailView(props: DailySnapshotDetailViewProps): ReactNode {
  const {
    delta,
    title,
    noBaselineMessage,
    moversSectionTitle,
    disclaimer,
    formatChangeLine,
    formatAmount,
    formatPercent,
    formatAssetLabel,
    formatFooterDate,
    staleBaselineLabel,
    allNewPositionsMessage,
    onMoverPress,
  } = props;

  const businessClasses = useBusinessClasses();

  if (delta.status === "no-baseline") {
    return (
      <View className="gap-2">
        <Text className={TYPO_SNAPSHOT_CARD_TITLE}>{title}</Text>
        <Text className={TYPO_CAPTION}>{noBaselineMessage}</Text>
      </View>
    );
  }

  if (delta.status === "empty-portfolio") {
    return null;
  }

  const totalSign = signOf(delta.totalDeltaReporting);
  const totalColorClass =
    totalSign === "positive"
      ? businessClasses.gain.text
      : totalSign === "negative"
        ? businessClasses.loss.text
        : businessClasses.pnlNeutral.text;

  const movers = visibleDailySnapshotMovers(delta);
  const allNewPositions = shouldShowAllNewPositionsHeadline(delta);

  return (
    <View className="gap-6">
      <View className="gap-1">
        <Text className={TYPO_SNAPSHOT_CARD_TITLE}>{title}</Text>
        {allNewPositions ? (
          <Text className={typographyClass("display2xl", businessClasses.pnlNeutral.text)}>
            {allNewPositionsMessage}
          </Text>
        ) : (
          <Text className={typographyClass("display2xl", totalColorClass)}>
            {formatChangeLine(delta.totalDeltaReporting, delta.totalDeltaPercent)}
          </Text>
        )}
        {delta.baselineAsOf ? (
          <Text className={TYPO_CAPTION}>{formatFooterDate(delta.baselineAsOf)}</Text>
        ) : null}
        {staleBaselineLabel ? <Text className={TYPO_CAPTION}>{staleBaselineLabel}</Text> : null}
      </View>

      {movers.length > 0 ? (
        <View className="gap-2">
          <Text className={TYPO_SECTION_TITLE}>{moversSectionTitle}</Text>
          <ListGroup>
            {movers.map((mover, index) => (
              <Fragment key={mover.assetId}>
                {onMoverPress ? (
                  <PressableFeedback animation={false} onPress={() => onMoverPress(mover.assetId)}>
                    <PressableFeedback.Scale>
                      <ListGroup.Item disabled>
                        <ListGroup.ItemContent>
                          <DailySnapshotMoverRow
                            mover={mover}
                            formatAssetLabel={formatAssetLabel}
                            formatAmount={formatAmount}
                            formatPercent={formatPercent}
                            accessibilityLabel={`${formatAssetLabel(mover.assetId)} ${formatPercent(mover.deltaPercent)}`}
                          />
                        </ListGroup.ItemContent>
                      </ListGroup.Item>
                    </PressableFeedback.Scale>
                    <PressableFeedback.Ripple />
                  </PressableFeedback>
                ) : (
                  <ListGroup.Item>
                    <ListGroup.ItemContent>
                      <DailySnapshotMoverRow
                        mover={mover}
                        formatAssetLabel={formatAssetLabel}
                        formatAmount={formatAmount}
                        formatPercent={formatPercent}
                      />
                    </ListGroup.ItemContent>
                  </ListGroup.Item>
                )}
                {index < movers.length - 1 ? <Separator className="mx-4" /> : null}
              </Fragment>
            ))}
          </ListGroup>
        </View>
      ) : null}

      <Text className={TYPO_DISCLAIMER}>{disclaimer}</Text>
    </View>
  );
}
