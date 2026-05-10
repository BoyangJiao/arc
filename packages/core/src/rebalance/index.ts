/**
 * rebalance — 再平衡引擎
 *
 * Stage 2 P0 实施（注：本仓库重新编号后，rebalance 基础版属于新 Stage 2）。
 *
 * CLAUDE.md 文案铁律：
 * - 输出永不出现"建议买入/卖出/应该 ..."字样
 * - 用"达到目标配置需要的份额变化为 ±X" / "偏离目标配置 Y%"
 *
 * ADR 003 涉及：
 * - deviationWarning / deviationCritical 是 Semantic 层 token，不在此模块直接引用颜色
 */

import type Decimal from "decimal.js";
import type {
  Holding,
  MarketValuation,
  TargetAllocation,
} from "../domain/types";

/** 单个资产的偏离度计算结果 */
export interface DeviationItem {
  readonly assetId: string;
  /** 当前占比，0–100 */
  readonly currentPercent: Decimal;
  /** 目标占比，0–100 */
  readonly targetPercent: Decimal;
  /** 偏离百分点：currentPercent - targetPercent；正 = 超配、负 = 欠配 */
  readonly deviationPercent: Decimal;
  /** 达到目标需要变化的份额（含正负，正 = 加仓、负 = 减仓） */
  readonly sharesNeeded: Decimal;
  /** 达到目标需要变化的金额（报告币种） */
  readonly amountNeeded: Decimal;
}

/**
 * computeRebalance — 计算所有持仓相对于目标配置的偏离度
 *
 * @stub Stage 2 实施
 */
export const computeRebalance = (
  _holdings: ReadonlyArray<Holding>,
  _valuations: ReadonlyArray<MarketValuation>,
  _targets: ReadonlyArray<TargetAllocation>,
): ReadonlyArray<DeviationItem> => {
  throw new Error("computeRebalance: not yet implemented (Stage 2 task)");
};

/**
 * 校验目标配置之和必须 = 100（在 ±0.01 容差内）
 *
 * @stub Stage 2 实施
 */
export const validateTargetAllocations = (
  _targets: ReadonlyArray<TargetAllocation>,
): ReadonlyArray<string> => {
  throw new Error("validateTargetAllocations: not yet implemented (Stage 2 task)");
};
