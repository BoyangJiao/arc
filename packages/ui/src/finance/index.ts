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

export { MarketChip, type MarketChipProps } from "./MarketChip";
export {
  AllocationDonut,
  type AllocationDonutProps,
  type AllocationDonutSlice,
} from "./AllocationDonut";
export { HoldingRow, type HoldingRowProps } from "./HoldingRow";
export {
  HoldingsTable,
  HOLDINGS_MARKET_ORDER,
  type HoldingsTableProps,
  type HoldingsTableRow,
} from "./HoldingsTable";
export {
  PortfolioValueOverTimeCard,
  type PortfolioValueOverTimeCardProps,
} from "./PortfolioValueOverTimeCard";
