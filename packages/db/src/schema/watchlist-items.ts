/**
 * watchlist_items — 用户的自选标的（关注但未持仓）
 *
 * 用途：
 *   - Stage 2 J8：Markets Tab 自选列表 + `/markets/search` 添加
 *   - 一行 = (user, asset) 的关注关系；持仓状态独立由 `transactions` 决定
 *
 * 设计要点：
 *   - 不存价格 / 涨跌幅 — 那些走 price_snapshots 缓存（与持仓共享缓存层）
 *   - `added_at desc` 索引支持 Markets Tab "最新在顶" 默认排序
 *   - UNIQUE (user_id, asset_id) — 同一资产不可重复添加
 *
 * RLS:
 *   - SELECT / INSERT / DELETE：user_id = auth.uid()
 *   - UPDATE：禁止（无可编辑字段；想"改"就 DELETE + INSERT）
 *
 * 见 .specify/feature-specs/watchlist-stage-2.md
 */

import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { assets } from "./assets";

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** 拥有者 — 引用 auth.users.id（Supabase Auth 管理）*/
    userId: uuid("user_id").notNull(),
    /** 资产 ID — `market:symbol`（如 `US:NVDA`）*/
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    /** 添加时间 — Markets Tab 默认排序键（desc：最新在顶）*/
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // 防重复：同一用户对同一资产只能有一行
    uniqueIndex("watchlist_items_user_asset_uniq").on(t.userId, t.assetId),
    // 默认排序索引：按用户 + 加入时间 desc
    index("watchlist_items_user_added_at_idx").on(t.userId, t.addedAt.desc()),
  ]
);

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type NewWatchlistItem = typeof watchlistItems.$inferInsert;
