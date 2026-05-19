-- Stage 2 J9 — Rebalance (step 3/3)
-- 前置：0006（CASH 枚举）+ 0007（target_allocations 表）均已提交。
-- Supabase SQL Editor：单独执行本文件。

INSERT INTO "assets" ("id", "market", "symbol", "name", "currency") VALUES
  ('CASH:USD', 'CASH', 'USD', '美元现金', 'USD'),
  ('CASH:CNY', 'CASH', 'CNY', '人民币现金', 'CNY'),
  ('CASH:HKD', 'CASH', 'HKD', '港元现金', 'HKD'),
  ('CASH:JPY', 'CASH', 'JPY', '日元现金', 'JPY')
ON CONFLICT ("id") DO NOTHING;
