-- Stage 2 J9 — Rebalance (step 1/3)
-- 见 .specify/feature-specs/stage-2/rebalance-stage-2.md
--
-- ⚠️ 必须单独执行本文件并 COMMIT，再跑 0007、0008。
-- Postgres 禁止在同一未提交事务里 ADD VALUE 后立刻 INSERT 使用该枚举值
--（错误 55P04: unsafe use of new value "CASH" of enum type market）。
-- Supabase SQL Editor：只粘贴本文件 → Run → 成功后再开下一个文件。

ALTER TYPE "market" ADD VALUE IF NOT EXISTS 'CASH';
