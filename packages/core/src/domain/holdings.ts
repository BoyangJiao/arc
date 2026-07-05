/**
 * holdings — 由交易流计算持仓的纯函数
 *
 * 关键约束（CLAUDE.md §3.2）：
 * - Holding 永远是派生数据，不可直接编辑
 * - 必须在每次涉及金额时用 Decimal
 * - 历史与当前快照分离（本函数计算"当前"快照；历史快照在 returns/ 中实现）
 */

import Decimal from "decimal.js";
import type { Currency, Holding, Transaction } from "./types";

/** 内部累加器 — 按 assetId 聚合的可变中间状态 */
interface HoldingAccumulator {
  shares: Decimal;
  averageCost: Decimal;
  totalCostBasis: Decimal;
  realizedPnL: Decimal;
  totalDividends: Decimal;
  portfolioId: string;
  currency: Currency;
}

/**
 * computeHoldings — 由 portfolio 内所有 transactions 重算当前持仓
 *
 * 行为：
 * - BUY: shares += t.shares；totalCostBasis += t.shares × t.pricePerShare + t.fee
 * - SELL: shares -= t.shares；totalCostBasis 按平均成本比例扣减；记录已实现盈亏
 * - DIVIDEND: 不影响 shares，不进 cost basis（按现金股息处理；股票股息走 SPLIT）
 * - SPLIT: shares 按拆分比例放大或缩小，averageCost 按比例反向调整
 * - ADJUSTMENT: 直接修改 shares / cost basis（用于纠错，留审计痕迹）
 *
 * 时序：内部按 tradeDate 升序防御性排序 — 平均成本 / 已实现盈亏依赖回放顺序，
 * 不能依赖调用方（DB 查询 / CSV 导入）保证有序。
 *
 * 超卖（SELL > 当前持有）：**容忍，不 throw** — 与 period-pnl 的回放语义一致。
 * CSV 导入 / 回溯录入随时可能出现临时超卖状态，一条坏数据不应让整个持仓
 * 视图崩溃。持有份额允许变负并保留在输出中（UI 可见即信号）；
 * 用 `validateTransactions` 获取结构化错误列表供 UI 提示修复。
 *
 * 输出 holdings 已按 assetId 聚合，shares=0 的资产从结果中剔除。
 */
export const computeHoldings = (
  transactions: ReadonlyArray<Transaction>
): ReadonlyArray<Holding> => {
  if (transactions.length === 0) {
    return [];
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );

  const accumulators = new Map<string, HoldingAccumulator>();

  for (const tx of sorted) {
    let acc = accumulators.get(tx.assetId);
    if (!acc) {
      acc = {
        shares: new Decimal(0),
        averageCost: new Decimal(0),
        totalCostBasis: new Decimal(0),
        realizedPnL: new Decimal(0),
        totalDividends: new Decimal(0),
        portfolioId: tx.portfolioId,
        currency: tx.currency,
      };
      accumulators.set(tx.assetId, acc);
    }

    switch (tx.type) {
      case "BUY": {
        const newShares = acc.shares.plus(tx.shares);
        // 加权平均成本 = (oldShares × oldAvgCost + newShares × price) / totalShares
        if (newShares.isZero()) {
          acc.averageCost = new Decimal(0);
        } else {
          acc.averageCost = acc.shares
            .times(acc.averageCost)
            .plus(tx.shares.times(tx.pricePerShare))
            .dividedBy(newShares);
        }
        acc.shares = newShares;
        acc.totalCostBasis = acc.totalCostBasis.plus(
          tx.shares.times(tx.pricePerShare).plus(tx.fee)
        );
        break;
      }

      case "SELL": {
        // 超卖不 throw（见函数 docstring）— 语义与 period-pnl applyToAccumulator 一致
        // 已实现盈亏 = quantity × (sellPrice - averageCost)
        acc.realizedPnL = acc.realizedPnL.plus(
          tx.shares.times(tx.pricePerShare.minus(acc.averageCost))
        );
        acc.shares = acc.shares.minus(tx.shares);
        // totalCostBasis 按平均成本比例扣减
        acc.totalCostBasis = acc.totalCostBasis.minus(tx.shares.times(acc.averageCost));
        // averageCost 不变
        break;
      }

      case "DIVIDEND": {
        // 现金股息：shares × pricePerShare（此处 pricePerShare 表示每股分红）
        const dividendAmount = tx.shares.times(tx.pricePerShare);
        acc.totalDividends = acc.totalDividends.plus(dividendAmount);
        break;
      }

      case "SPLIT": {
        // pricePerShare 用作拆分比例（splitRatio）
        // 例如 1:2 拆股，splitRatio = 2，shares 翻倍，averageCost 减半
        const splitRatio = tx.pricePerShare;
        acc.shares = acc.shares.times(splitRatio);
        if (!splitRatio.isZero()) {
          acc.averageCost = acc.averageCost.dividedBy(splitRatio);
        }
        // totalCostBasis 保持不变（总成本不因拆股变化）
        break;
      }

      case "ADJUSTMENT": {
        // Stage 1 简化：直接修改 shares
        acc.shares = acc.shares.plus(tx.shares);
        acc.totalCostBasis = acc.totalCostBasis.plus(tx.shares.times(tx.pricePerShare));
        if (!acc.shares.isZero()) {
          acc.averageCost = acc.totalCostBasis.dividedBy(acc.shares);
        }
        break;
      }
    }
  }

  // 转为不可变 Holding，剔除 shares=0 的资产
  const result: Holding[] = [];
  for (const [assetId, acc] of accumulators) {
    if (!acc.shares.isZero()) {
      result.push({
        assetId,
        shares: acc.shares,
        averageCost: acc.averageCost,
        totalCostBasis: acc.totalCostBasis,
        realizedPnL: acc.realizedPnL,
        totalDividends: acc.totalDividends,
        portfolioId: acc.portfolioId,
        currency: acc.currency,
      });
    }
  }
  return result;
};

/**
 * 验证一组 transactions 是否一致（防止 SELL 超过 BUY 等）
 *
 * @returns 错误列表；空数组表示通过
 */
export const validateTransactions = (
  transactions: ReadonlyArray<Transaction>
): ReadonlyArray<string> => {
  const errors: string[] = [];
  const sharesMap = new Map<string, Decimal>();

  for (const tx of transactions) {
    const current = sharesMap.get(tx.assetId) ?? new Decimal(0);

    switch (tx.type) {
      case "BUY":
        sharesMap.set(tx.assetId, current.plus(tx.shares));
        break;
      case "SELL":
        if (tx.shares.greaterThan(current)) {
          errors.push(
            `SELL of ${tx.shares.toString()} shares exceeds holding of ${current.toString()} for ${tx.assetId}`
          );
        }
        sharesMap.set(tx.assetId, current.minus(tx.shares));
        break;
      case "SPLIT":
        sharesMap.set(tx.assetId, current.times(tx.pricePerShare));
        break;
      case "ADJUSTMENT":
        sharesMap.set(tx.assetId, current.plus(tx.shares));
        break;
      default:
        // DIVIDEND doesn't affect shares
        break;
    }
  }

  return errors;
};

// 显式导出 Decimal 让上层不必单独 import（领域代码统一从 @arc/core 取）
export { Decimal };
