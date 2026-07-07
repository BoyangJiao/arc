-- Stage 3 — 资产位置敞口 (#12): tag each transaction with the holding account/platform.
-- NULL = unassigned (grouped as ACCOUNT_UNASSIGNED in exposure aggregation). Display-only
-- grouping field; does not affect holdings math (持仓 = Σ交易, 不变性 2). RLS unchanged
-- (column add on an already-protected table).

ALTER TABLE "transactions"
  ADD COLUMN "account" text NULL;
