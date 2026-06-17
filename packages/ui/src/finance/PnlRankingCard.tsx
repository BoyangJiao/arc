/**
 * PnlRankingCard — 盈亏排行 card with 盈利/亏损 tabs (Insights 盈亏分析, L3).
 *
 * Spec: pnl-analysis-insights §J18d / 决策 6. Tab switches winners/losers; each
 * RankingRow taps through to Asset Detail (AC.3.2). Empty state for the 首日 (C)
 * user (AC.3.4). Presentational — rows pre-built by the screen.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Segment } from "heroui-native-pro/segment";

import { Text } from "../primitives/Text";
import { TYPO_CONTROL_LABEL, TYPO_EMPTY_MESSAGE } from "../tokens/typography";

import { InsightSection } from "./InsightSection";
import { RankingRow } from "./RankingRow";
import type { PnlSign } from "./pnl-types";
import type { RebalanceMarket } from "./rebalance-types";

export type PnlRankingTab = "winners" | "losers";

export interface PnlRankingRowData {
  readonly assetId: string;
  readonly name: string;
  readonly symbol: string;
  readonly market: RebalanceMarket;
  readonly marketLabel: string;
  readonly imageUrl?: string | null;
  readonly symbolLabel?: string;
  readonly contributionLabel: string;
  readonly sign: PnlSign;
  readonly rightSubLabel?: string;
  readonly accessibilityLabel?: string;
}

export interface PnlRankingCardProps {
  readonly sectionTitle: string;
  readonly winnersTabLabel: string;
  readonly losersTabLabel: string;
  readonly activeTab: PnlRankingTab;
  readonly onTabChange: (tab: PnlRankingTab) => void;
  readonly rows: ReadonlyArray<PnlRankingRowData>;
  readonly emptyLabel: string;
  readonly onRowPress?: (assetId: string) => void;
}

export function PnlRankingCard(props: PnlRankingCardProps): ReactNode {
  const {
    sectionTitle,
    winnersTabLabel,
    losersTabLabel,
    activeTab,
    onTabChange,
    rows,
    emptyLabel,
    onRowPress,
  } = props;

  return (
    <InsightSection title={sectionTitle} bodyClassName="gap-4">
      <Segment
        className="w-full gap-0"
        value={activeTab}
        size="sm"
        onValueChange={(next) => onTabChange(next as PnlRankingTab)}
      >
        <Segment.Group className="w-full self-stretch flex-row bg-transparent p-0 gap-0 rounded-none shadow-none">
          <Segment.Indicator className="bg-surface-secondary shadow-none" />
          <Segment.Item value="winners" className="flex-1 min-w-0 px-0 py-1">
            <Segment.Label className={`${TYPO_CONTROL_LABEL} text-center`}>
              {winnersTabLabel}
            </Segment.Label>
          </Segment.Item>
          <Segment.Item value="losers" className="flex-1 min-w-0 px-0 py-1">
            <Segment.Label className={`${TYPO_CONTROL_LABEL} text-center`}>
              {losersTabLabel}
            </Segment.Label>
          </Segment.Item>
        </Segment.Group>
      </Segment>

      {rows.length === 0 ? (
        <View className="items-center py-8">
          <Text className={`${TYPO_EMPTY_MESSAGE} text-center`}>{emptyLabel}</Text>
        </View>
      ) : (
        <View className="-my-1">
          {rows.map((row) => (
            <RankingRow
              key={row.assetId}
              name={row.name}
              symbol={row.symbol}
              market={row.market}
              marketLabel={row.marketLabel}
              imageUrl={row.imageUrl}
              symbolLabel={row.symbolLabel}
              contributionLabel={row.contributionLabel}
              sign={row.sign}
              rightSubLabel={row.rightSubLabel}
              accessibilityLabel={row.accessibilityLabel}
              onPress={onRowPress ? () => onRowPress(row.assetId) : undefined}
            />
          ))}
        </View>
      )}
    </InsightSection>
  );
}
