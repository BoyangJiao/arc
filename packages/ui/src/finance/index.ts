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
  CrossPortfolioRebalancePlaceholderCard,
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
  ALLOCATION_PALETTE,
  type AllocationDonutProps,
  type AllocationDonutSlice,
} from "./AllocationDonut";
export { InsightSection, type InsightSectionProps } from "./InsightSection";
export { ExposureSummaryTile, type ExposureSummaryTileProps } from "./ExposureSummaryTile";
export {
  PortfolioToggleGroup,
  type PortfolioToggleGroupProps,
  type PortfolioToggleOption,
} from "./PortfolioToggleGroup";
export { SegmentToggle, type SegmentToggleProps, type SegmentToggleOption } from "./SegmentToggle";
export { InsightTierBadge, type InsightTier, type InsightTierBadgeProps } from "./InsightTierBadge";
export { ChangePercentBadge, type ChangePercentBadgeProps } from "./ChangePercentBadge";
export { HoldingRow, type HoldingRowProps, type HoldingPeriodChange } from "./HoldingRow";
export {
  HoldingsTable,
  HOLDINGS_MARKET_ORDER,
  type HoldingsTableProps,
  type HoldingsTableRow,
} from "./HoldingsTable";
export {
  HoldingsSortControl,
  type HoldingsSortControlProps,
  type HoldingsSortKey,
  type HoldingsSortOption,
} from "./HoldingsSortControl";
export { PortfolioHeroSection, type PortfolioHeroSectionProps } from "./PortfolioHeroSection";
export { FlippingNumberText, type FlippingNumberTextProps } from "./FlippingNumberText";
export {
  TwrInlineLabel,
  type TwrInlineLabelProps,
  type TwrInlineLabelResult,
} from "./TwrInlineLabel";
export {
  HoldingReturnInlineLabel,
  type HoldingReturnInlineLabelProps,
} from "./HoldingReturnInlineLabel";
export { InfoTooltipButton, type InfoTooltipButtonProps } from "./InfoTooltipButton";
export {
  computePeriodChange,
  computePeriodChangeFromBaseline,
  firstNonZeroChartY,
  type PeriodChange,
} from "./compute-period-change";
export {
  TransactionAmountModeToggle,
  type TransactionAmountMode,
  type TransactionAmountModeToggleProps,
} from "./TransactionAmountModeToggle";
export { AMOUNT_REDACTION_MASK } from "./amount-redaction";
export { AmountVisibilityToggle, type AmountVisibilityToggleProps } from "./AmountVisibilityToggle";
export {
  formatCompactChangeLine,
  formatSignedAmount,
  formatSignedPercent,
  formatUnsignedPercent,
  type FormatCompactChangeLineOptions,
} from "./format-compact-change";
export { type ChartScrubState, scrubStateFromChartPoint, periodStartValue } from "./chart-scrub";
export {
  PortfolioValueOverTimeCard,
  type PortfolioValueOverTimeCardProps,
} from "./PortfolioValueOverTimeCard";
export { type PnlSign, pnlTextClass } from "./pnl-types";
export { RankingRow, type RankingRowProps } from "./RankingRow";
export { PnlPeriodCard, type PnlPeriodCardProps, type PnlMetricRow } from "./PnlPeriodCard";
export { PnlCumulativeCard, type PnlCumulativeCardProps } from "./PnlCumulativeCard";
export {
  PnlRankingCard,
  type PnlRankingCardProps,
  type PnlRankingRowData,
  type PnlRankingTab,
} from "./PnlRankingCard";
