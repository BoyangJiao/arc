-- Stage 3 Block A — CN / HK / FUND asset catalog + RLS for manual registration
-- 前置：0001（US insert）+ 0006（market enum 含 CN/HK/FUND）
-- Supabase SQL Editor：单独执行本文件（与 0008 cash seed 相同流程）

INSERT INTO "assets" ("id", "market", "symbol", "name", "currency") VALUES
  ('CN:600519', 'CN', '600519', '贵州茅台', 'CNY'),
  ('HK:00700', 'HK', '00700', '腾讯控股', 'HKD'),
  ('FUND:000001', 'FUND', '000001', '华夏成长', 'CNY'),
  ('FUND:510300', 'FUND', '510300', '沪深300ETF', 'CNY')
ON CONFLICT ("id") DO NOTHING;

CREATE POLICY "assets_authenticated_insert_cn_hk_fund"
  ON "assets"
  FOR INSERT
  TO authenticated
  WITH CHECK (market IN ('CN', 'HK', 'FUND'));
