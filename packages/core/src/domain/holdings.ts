/**
 * holdings — 由交易流计算持仓的纯函数
 *
 * 关键约束（CLAUDE.md §3.2）：
 * - Holding 永远是派生数据，不可直接编辑
 * - 必须在每次涉及金额时用 Decimal
 * - 历史与当前快照分离（本函数计算"当前"快照；历史快照在 returns/ 中实现）
 *
 * Stage 1 实施时填实现；当前留 stub 让上层 import 不报错。
 */

import Decimal from "decimal.js";
import type { Holding, Transaction } from "./types";

/**
 * computeHoldings — 由 portfolio 内所有 transactions 重算当前持仓
 *
 * 行为：
 * - BUY: shares += t.shares；totalCostBasis += t.shares × t.pricePerShare + t.fee
 * - SELL: shares -= t.shares；totalCostBasis 按平均成本比例扣减
 * - DIVIDEND: 不影响 shares，不进 cost basis（按现金股息处理；股票股息走 SPLIT）
 * - SPLIT: shares 按拆分比例放大或缩小，averageCost 按比例反向调整
 * - ADJUSTMENT: 直接修改 shares / cost basis（用于纠错，留审计痕迹）
 *
 * 输出 holdings 已按 assetId 聚合，shares=0 的资产从结果中剔除。
 *
 * @stub Stage 1 实施时填实现
 */
export const computeHoldings = (
  _transactions: ReadonlyArray<Transaction>,
): ReadonlyArray<Holding> => {
  // TODO Stage 1 实施
  throw new Error("computeHoldings: not yet implemented (Stage 1 task)");
};

/**
 * 验证一组 transactions 是否一致（防止 SELL 超过 BUY 等）
 *
 * @returns 错误列表；空数组表示通过
 * @stub Stage 1 实施
 */
export const validateTransactions = (
  _transactions: ReadonlyArray<Transaction>,
): ReadonlyArray<string> => {
  // TODO Stage 1 实施
  return [];
};

// 显式导出 Decimal 让上层不必单独 import（领域代码统一从 @arc/core 取）
export { Decimal };
