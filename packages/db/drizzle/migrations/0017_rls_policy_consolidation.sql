-- 0017 — RLS policy 合并 + FK covering 索引（2026-07-15 advisor 卫生批次）
--
-- 背景：Supabase performance advisor 报 multiple_permissive_policies（同表同
-- role/action 多条 permissive policy 逐条求值）+ unindexed_foreign_keys。
-- 本迁移完全保语义：每条被 drop 的 policy 都被保留/合并后的 policy 全覆盖。
--
-- ⚠️ 有意不动：fx_rates / price_snapshots 的 INSERT `with_check (true)` =
-- 风险登记册 R8（共享缓存表投毒，上架 blocker），绑定阿里云迁移轮的
-- 服务端写代理方案。见 docs/project-background.md 风险登记册。

-- assets: 3 条等价 USING(true) SELECT policy → 只留 public_read（覆盖 anon+authenticated）
drop policy if exists "assets_anon_read" on public.assets;
drop policy if exists "assets_authenticated_read" on public.assets;

-- assets: 4 条按市场拆的 INSERT policy（0001/0009/0010/0013 逐次追加）→ 1 条显式清单
-- 并集不变 = 全部 6 个现有 market；enum 未来扩值时默认拒绝（与原语义一致）
drop policy if exists "assets_authenticated_insert_cash" on public.assets;
drop policy if exists "assets_authenticated_insert_cn_hk_fund" on public.assets;
drop policy if exists "assets_authenticated_insert_crypto" on public.assets;
drop policy if exists "assets_authenticated_insert_us" on public.assets;
create policy "assets_authenticated_insert" on public.assets
  for insert to authenticated
  with check (market = any (array['CASH','CN','HK','FUND','CRYPTO','US']::market[]));

-- fx_rates / price_snapshots: 同样的重复 SELECT 清理
drop policy if exists "fx_rates_anon_read" on public.fx_rates;
drop policy if exists "fx_rates_authenticated_read" on public.fx_rates;
drop policy if exists "price_snapshots_anon_read" on public.price_snapshots;
drop policy if exists "price_snapshots_authenticated_read" on public.price_snapshots;

-- portfolio_value_snapshots: 两条完全相同的 owner-SELECT → 留 user_select
drop policy if exists "pv_snapshots_owner_select" on public.portfolio_value_snapshots;

-- FK covering 索引（advisor: unindexed_foreign_keys；已同步 Drizzle schema）
create index if not exists target_allocations_asset_id_idx on public.target_allocations (asset_id);
create index if not exists watchlist_items_asset_id_idx on public.watchlist_items (asset_id);
