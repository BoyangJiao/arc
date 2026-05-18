/**
 * Watchlist — J8 Markets Tab 读模型
 *
 * 纯类型；排序与过滤在 TanStack hook 层完成。
 * 见 .specify/feature-specs/watchlist-stage-2.md §@arc/core additions
 */

import type { Decimal } from "decimal.js";
import type { Asset, Currency } from "./types";

export interface WatchlistRow {
  readonly id: string;
  /** ISO 8601 — watchlist_items.added_at */
  readonly addedAt: string;
  readonly asset: Asset;
  /** null until first quote lands */
  readonly quote: {
    readonly price: Decimal;
    readonly currency: Currency;
    /** null if previous close unknown */
    readonly changePercent: Decimal | null;
    /** ISO 8601 */
    readonly asOf: string;
    /** true if last update > 5 min ago */
    readonly stale: boolean;
  } | null;
}
