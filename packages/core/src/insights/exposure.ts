/**
 * insights/exposure — 持仓敞口聚合（Insights 扩充 spec #4 市场敞口 / #5 币种敞口）
 *
 * 纯函数、无 IO、Decimal everywhere（宪法 §3.1）。
 * 输入读"报告货币市值"（`MarketValuation.valueReporting`），原始币种永不预换算（不变性 4）：
 * 币种敞口按 `nativeCurrency` 分组，但占比基于报告货币口径，确保跨币种可比。
 */

import Decimal from "decimal.js";
import { parseAssetId, type Currency, type Market, type MarketValuation } from "../domain/types";

/** 单个敞口分片：报告货币市值合计 + 占比（0..1）。按 value 降序排列。 */
export interface ExposureSlice<G extends string = string> {
  readonly group: G;
  /** 该分组在报告货币下的市值合计 */
  readonly value: Decimal;
  /** 占比 = value / total，范围 [0, 1]；total ≤ 0 时返回空数组（不会出现此字段） */
  readonly weight: Decimal;
}

/**
 * aggregateExposure — 通用分组聚合。
 * - 同 group 的 value 累加；
 * - total ≤ 0（无持仓 / 全 0 市值）→ 返回空数组（调用方按空态处理，对齐 AllocationDonut）；
 * - 结果按 value 降序，weight = value / total。
 *
 * weight 之和在 Decimal 默认精度下 ≈ 1（末位 rounding 容差，property test 守护）。
 */
export const aggregateExposure = <G extends string>(
  rows: ReadonlyArray<{ readonly group: G; readonly value: Decimal }>
): ReadonlyArray<ExposureSlice<G>> => {
  const sums = new Map<G, Decimal>();
  let total = new Decimal(0);

  for (const row of rows) {
    // 负市值（理论上 long-only MVP 不出现）不计入，避免占比失真
    if (row.value.lessThanOrEqualTo(0)) continue;
    sums.set(row.group, (sums.get(row.group) ?? new Decimal(0)).plus(row.value));
    total = total.plus(row.value);
  }

  if (total.lessThanOrEqualTo(0)) return [];

  return [...sums.entries()]
    .map(([group, value]) => ({ group, value, weight: value.dividedBy(total) }))
    .sort((a, b) => b.value.comparedTo(a.value));
};

/** 敞口分组明细：分组占比 + 组内成员资产（用于详情页可展开图例）。 */
export interface ExposureMember {
  readonly assetId: string;
  readonly value: Decimal;
  /** 组内占比 = value / groupTotal，[0,1]。 */
  readonly weightInGroup: Decimal;
}
export interface ExposureGroupBreakdown<G extends string = string> extends ExposureSlice<G> {
  /** 组内成员，按 value 降序。 */
  readonly members: ReadonlyArray<ExposureMember>;
}

const breakdownBy = <G extends string>(
  rows: ReadonlyArray<{ readonly group: G; readonly assetId: string; readonly value: Decimal }>
): ReadonlyArray<ExposureGroupBreakdown<G>> => {
  const top = aggregateExposure(rows);
  const membersByGroup = new Map<G, ExposureMember[]>();
  for (const r of rows) {
    if (r.value.lessThanOrEqualTo(0)) continue;
    const group = top.find((g) => g.group === r.group);
    if (!group) continue;
    const list = membersByGroup.get(r.group) ?? [];
    list.push({
      assetId: r.assetId,
      value: r.value,
      weightInGroup: r.value.dividedBy(group.value),
    });
    membersByGroup.set(r.group, list);
  }
  return top.map((g) => ({
    ...g,
    members: (membersByGroup.get(g.group) ?? []).sort((a, b) => b.value.comparedTo(a.value)),
  }));
};

/** 市场敞口明细（含组内资产）。 */
export const marketExposureBreakdown = (
  perAsset: ReadonlyArray<MarketValuation>
): ReadonlyArray<ExposureGroupBreakdown<Market>> =>
  breakdownBy(
    perAsset.map((v) => ({
      group: parseAssetId(v.assetId).market,
      assetId: v.assetId,
      value: v.valueReporting,
    }))
  );

/** 币种敞口明细（含组内资产）。 */
export const currencyExposureBreakdown = (
  perAsset: ReadonlyArray<MarketValuation>
): ReadonlyArray<ExposureGroupBreakdown<Currency>> =>
  breakdownBy(
    perAsset.map((v) => ({ group: v.nativeCurrency, assetId: v.assetId, value: v.valueReporting }))
  );

/** 市场/地域敞口（CN/HK/US/CRYPTO/FUND/CASH），market 由 assetId 派生（不变性 1）。 */
export const marketExposure = (
  perAsset: ReadonlyArray<MarketValuation>
): ReadonlyArray<ExposureSlice<Market>> =>
  aggregateExposure(
    perAsset.map((v) => ({ group: parseAssetId(v.assetId).market, value: v.valueReporting }))
  );

/** 币种敞口，按持仓原始币种（nativeCurrency）分组，占比基于报告货币市值。 */
export const currencyExposure = (
  perAsset: ReadonlyArray<MarketValuation>
): ReadonlyArray<ExposureSlice<Currency>> =>
  aggregateExposure(perAsset.map((v) => ({ group: v.nativeCurrency, value: v.valueReporting })));
