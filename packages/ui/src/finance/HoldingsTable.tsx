/**
 * HoldingsTable — flat holdings list in a single ListGroup card.
 */

import type { ReactNode } from "react";
import { Fragment } from "react";
import { View } from "react-native";
import type { RebalanceMarket } from "./rebalance-types";

import { ListGroup, PressableFeedback, Separator } from "../primitives";
import { Text } from "../primitives/Text";
import { TYPO_CAPTION, TYPO_SECTION_TITLE } from "../tokens/typography";

import { HoldingRow, type HoldingRowProps } from "./HoldingRow";

/** Row sort order when aggregated (Block C spec decision #4). */
export const HOLDINGS_MARKET_ORDER: readonly RebalanceMarket[] = [
  "US",
  "CN",
  "HK",
  "FUND",
  "CRYPTO",
  "CASH",
] as const;

export interface HoldingsTableRow extends HoldingRowProps {
  readonly assetId: string;
  readonly market: RebalanceMarket;
}

export interface HoldingsTableProps {
  readonly rows: ReadonlyArray<HoldingsTableRow>;
  readonly sectionTitle: string;
  readonly onRowPress: (assetId: string) => void;
  readonly emptyMessage?: string;
}

export function HoldingsTable({
  rows,
  sectionTitle,
  onRowPress,
  emptyMessage,
}: HoldingsTableProps): ReactNode {
  if (rows.length === 0) {
    return emptyMessage ? (
      <View className="gap-2">
        <Text className={TYPO_SECTION_TITLE}>{sectionTitle}</Text>
        <Text className={TYPO_CAPTION}>{emptyMessage}</Text>
      </View>
    ) : null;
  }

  return (
    <View className="gap-2">
      <Text className={TYPO_SECTION_TITLE}>{sectionTitle}</Text>
      <ListGroup>
        {rows.map((row, index) => (
          <Fragment key={row.assetId}>
            <PressableFeedback animation={false} onPress={() => onRowPress(row.assetId)}>
              <PressableFeedback.Scale>
                <ListGroup.Item disabled>
                  <ListGroup.ItemContent>
                    <HoldingRow
                      symbol={row.symbol}
                      name={row.name}
                      market={row.market}
                      marketLabel={row.marketLabel}
                      imageUrl={row.imageUrl}
                      positionLabel={row.positionLabel}
                      valueLabel={row.valueLabel}
                      valueLoading={row.valueLoading}
                      periodChange={row.periodChange}
                      newPositionLabel={row.newPositionLabel}
                      formatPeriodChangeLine={row.formatPeriodChangeLine}
                      snapshotBadgeLabel={row.snapshotBadgeLabel}
                      accessibilityLabel={row.accessibilityLabel}
                    />
                  </ListGroup.ItemContent>
                </ListGroup.Item>
              </PressableFeedback.Scale>
              <PressableFeedback.Ripple />
            </PressableFeedback>
            {index < rows.length - 1 ? <Separator className="mx-4" /> : null}
          </Fragment>
        ))}
      </ListGroup>
    </View>
  );
}
