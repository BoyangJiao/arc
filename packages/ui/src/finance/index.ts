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
