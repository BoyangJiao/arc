/**
 * rebalance — 再平衡引擎 (Stage 2 J9)
 *
 * 见 .specify/feature-specs/rebalance-stage-2.md
 *
 * CLAUDE.md 文案铁律：
 * - 输出永不出现"建议买入/卖出/应该 ..."字样
 * - 用"达到目标配置需要的份额变化为 ±X" / "偏离目标配置 Y%"
 *
 * ADR 003：
 * - `deviationWarning` / `deviationCritical` 是 Business 层 token，颜色不在此模块引用
 *
 * 纯函数模块。所有金额/份额 Decimal；不做 I/O。
 */

import Decimal from "decimal.js";

import { parseAssetId } from "../domain/types";
import type { Holding, MarketValuation, TargetAllocation } from "../domain/types";

import { roundShares } from "./rounding";

// ────────────────────────────────────────────────────────────────────────────
// Public types

/** 单个资产的偏离度计算结果 */
export interface DeviationItem {
  readonly assetId: string;
  /** 当前占比，0–100（基于总组合估值） */
  readonly currentPercent: Decimal;
  /** 目标占比，0–100（来自 target_allocations） */
  readonly targetPercent: Decimal;
  /** 偏离百分点：currentPercent - targetPercent；正 = 超配、负 = 欠配 */
  readonly deviationPercent: Decimal;
  /** 达到目标需要变化的份额（含正负，正 = 加仓、负 = 减仓）。已按市场取整 */
  readonly sharesNeeded: Decimal;
  /** 达到目标需要变化的金额（报告币种，未取整） */
  readonly amountNeeded: Decimal;
}

/**
 * `validateTargetAllocations` 返回的结构化错误。
 *
 * 调用方（mobile/setup form）按 code 映射到 i18n 文案 + 字段高亮。
 */
export type TargetAllocationError =
  | { readonly code: "empty" }
  | { readonly code: "duplicate_asset"; readonly assetId: string }
  | { readonly code: "percent_out_of_range"; readonly assetId: string; readonly value: Decimal }
  | { readonly code: "sum_not_100"; readonly actual: Decimal };

// ────────────────────────────────────────────────────────────────────────────
// Constants

/** Sum-to-100 tolerance — accommodates UI rounding when user types `33.33 / 33.33 / 33.34`. */
const SUM_TOLERANCE = new Decimal("0.01");

// ────────────────────────────────────────────────────────────────────────────
// validateTargetAllocations

/**
 * 校验目标配置数组。
 *
 * 规则：
 * 1. 非空
 * 2. assetId 不重复
 * 3. 每条 targetPercent 在 [0, 100]
 * 4. Σ targetPercent = 100 ± 0.01
 *
 * @returns 错误数组；空数组表示通过
 */
export const validateTargetAllocations = (
  targets: ReadonlyArray<TargetAllocation>
): ReadonlyArray<TargetAllocationError> => {
  const errors: TargetAllocationError[] = [];

  if (targets.length === 0) {
    errors.push({ code: "empty" });
    return errors;
  }

  const seen = new Set<string>();
  let sum = new Decimal(0);

  for (const t of targets) {
    if (seen.has(t.assetId)) {
      errors.push({ code: "duplicate_asset", assetId: t.assetId });
    }
    seen.add(t.assetId);

    if (t.targetPercent.lt(0) || t.targetPercent.gt(100)) {
      errors.push({
        code: "percent_out_of_range",
        assetId: t.assetId,
        value: t.targetPercent,
      });
    }

    sum = sum.plus(t.targetPercent);
  }

  if (sum.minus(100).abs().gt(SUM_TOLERANCE)) {
    errors.push({ code: "sum_not_100", actual: sum });
  }

  return errors;
};

// ────────────────────────────────────────────────────────────────────────────
// computeRebalance

/**
 * 计算每个**已持有且已设目标**资产的偏离度 + 行动量。
 *
 * Stage 2 行为约定（spec §Resolved decisions #3 — internal only）：
 * - 总组合估值（totalValue）= Σ valuations.valueReporting（含现金 CASH:*）
 * - 仅对 valuations 内存在的 target 资产产出 DeviationItem
 *   * 目标里有但未持有的资产 → 跳过；setup 表单约束防止此情况
 *   * 持有但未设目标的资产 → 跳过；UI 单独以"未配置目标"提示
 * - sharesNeeded 按市场规则取整（toward zero，避免超买超卖）
 * - amountNeeded 是**未取整**的报告币种差额 — 保持精确，UI 渲染可展示残差
 *
 * @param _holdings 当前持仓（Stage 2 未直接使用；保留参数便于 Stage 3 扩展）
 * @param valuations 已估值的持仓（每条含 priceNative + fxRateUsed + valueReporting）
 * @param targets   用户目标配置
 */
export const computeRebalance = (
  _holdings: ReadonlyArray<Holding>,
  valuations: ReadonlyArray<MarketValuation>,
  targets: ReadonlyArray<TargetAllocation>
): ReadonlyArray<DeviationItem> => {
  // Total portfolio value across ALL valuations (denominator for percentages)
  const totalValue = valuations.reduce((acc, v) => acc.plus(v.valueReporting), new Decimal(0));

  // No value yet → can't divide; nothing actionable
  if (totalValue.isZero()) return [];

  const valByAsset = new Map<string, MarketValuation>(
    valuations.map((v) => [v.assetId, v] as const)
  );

  const items: DeviationItem[] = [];
  for (const t of targets) {
    const val = valByAsset.get(t.assetId);
    if (!val) continue; // target for unowned asset → skip

    if (val.shares.isZero()) continue; // defensive: can't price-per-share with 0 shares

    const currentValue = val.valueReporting;
    const currentPercent = currentValue.div(totalValue).times(100);
    const deviationPercent = currentPercent.minus(t.targetPercent);

    // Target value in reporting currency = targetPercent/100 × totalValue
    const targetValue = t.targetPercent.div(100).times(totalValue);
    // amountNeeded > 0 → underweight, want to BUY; < 0 → overweight, want to SELL
    const amountNeeded = targetValue.minus(currentValue);

    // sharesNeeded raw = amountNeeded / (price per share in reporting currency)
    // Use valueReporting / shares to avoid recomputing FX (val.shares > 0 by guard above)
    const pricePerShareReporting = val.valueReporting.div(val.shares);
    const rawShares = amountNeeded.div(pricePerShareReporting);

    const { market } = parseAssetId(t.assetId);
    const sharesNeeded = roundShares(rawShares, market, val.nativeCurrency);

    items.push({
      assetId: t.assetId,
      currentPercent,
      targetPercent: t.targetPercent,
      deviationPercent,
      sharesNeeded,
      amountNeeded,
    });
  }

  return items;
};
