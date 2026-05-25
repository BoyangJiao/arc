/**
 * finance/ — T2 自建金融领域组件（ADR 006 §决策二）
 *
 * Stage 2 起开始填充：
 *   - DailySnapshotCard (Stage 2 J7 — Daily Snapshot)
 *
 * Stage 2-3 候选: PriceCell, PnLBadge, AllocationDonut, MaskedNumber, TrendChip,
 *               PriceDelayIndicator, GainLossArrow, CurrencyAmount。
 *
 * 业务代码只 `import from '@arc/ui'`，本目录的 flat 命名空间通过根 index re-export。
 */

export {
  DailySnapshotCard,
  type DailySnapshotCardProps,
  type DailySnapshotDelta,
  type DailySnapshotAssetDelta,
} from "./DailySnapshotCard";
export {
  DailySnapshotDetailView,
  type DailySnapshotDetailViewProps,
} from "./DailySnapshotDetailView";
export { DailySnapshotMoverRow, type DailySnapshotMoverRowProps } from "./DailySnapshotMoverRow";

export { DailyMoverChips, type DailyMoverChipsProps } from "./DailyMoverChips";

export { WatchlistRow, type WatchlistRowProps } from "./WatchlistRow";
export { WatchlistEmptyState, type WatchlistEmptyStateProps } from "./WatchlistEmptyState";
export { WatchlistSearchField, type WatchlistSearchFieldProps } from "./WatchlistSearchField";
export {
  PortfolioExpandablePanel,
  type PortfolioExpandablePanelProps,
  type PortfolioExpandableHoldingRow,
  type PortfolioExpandablePortfolioRow,
} from "./PortfolioExpandablePanel";

export {
  TargetAllocationForm,
  type TargetAllocationFormProps,
  type TargetAllocationFormRow,
  type TargetSumStatus,
} from "./TargetAllocationForm";
export { DeviationDonut, type DeviationDonutProps } from "./DeviationDonut";
export { DeviationBar, type DeviationBarProps } from "./DeviationBar";
export { RebalanceActionList, type RebalanceActionListProps } from "./RebalanceActionList";
export {
  HardDeleteConfirmDialog,
  type HardDeleteConfirmDialogProps,
} from "./HardDeleteConfirmDialog";
export {
  CashBalanceTransferSheet,
  type CashBalanceTransferSheetProps,
  type TransferCurrencyOption,
  type TransferDestOption,
} from "./CashBalanceTransferSheet";
export {
  PortfolioInsightCard,
  CrossPortfolioRebalancePlaceholderCard,
  type PortfolioInsightCardProps,
  type CrossPortfolioRebalancePlaceholderCardProps,
} from "./PortfolioInsightCard";
export {
  deviationTierFromPercent,
  type DeviationTier,
  type RebalanceDonutSegment,
  type DeviationBarRow,
  type RebalanceActionRow,
} from "./rebalance-types";

export { AssetAvatar, type AssetAvatarProps } from "./AssetAvatar";
export { MarketChip, type MarketChipProps } from "./MarketChip";
export { HoldingsMarketFilter, type HoldingsMarketFilterProps } from "./HoldingsMarketFilter";
export {
  AllocationDonut,
  type AllocationDonutProps,
  type AllocationDonutSlice,
} from "./AllocationDonut";
export { ChangePercentBadge, type ChangePercentBadgeProps } from "./ChangePercentBadge";
export { HoldingRow, type HoldingRowProps, type HoldingPeriodChange } from "./HoldingRow";
export {
  HoldingsTable,
  HOLDINGS_MARKET_ORDER,
  type HoldingsTableProps,
  type HoldingsTableRow,
} from "./HoldingsTable";
export { PortfolioHeroSection, type PortfolioHeroSectionProps } from "./PortfolioHeroSection";
export { FlippingNumberText, type FlippingNumberTextProps } from "./FlippingNumberText";
export { computePeriodChange, type PeriodChange } from "./compute-period-change";
export {
  formatCompactChangeLine,
  formatSignedAmount,
  formatSignedPercent,
  formatUnsignedPercent,
} from "./format-compact-change";
export { type ChartScrubState, scrubStateFromChartPoint, periodStartValue } from "./chart-scrub";
export {
  PortfolioValueOverTimeCard,
  type PortfolioValueOverTimeCardProps,
} from "./PortfolioValueOverTimeCard";
