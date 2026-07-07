/**
 * insights/exposure — 持仓敞口聚合（Insights 扩充 spec #4 市场敞口 / #5 币种敞口）
 *
 * 纯函数、无 IO、Decimal everywhere（宪法 §3.1）。
 * 输入读"报告货币市值"（`MarketValuation.valueReporting`），原始币种永不预换算（不变性 4）：
 * 币种敞口按 `nativeCurrency` 分组，但占比基于报告货币口径，确保跨币种可比。
 */

import Decimal from "decimal.js";
import {
  parseAssetId,
  type Currency,
  type Market,
  type MarketValuation,
  type Transaction,
} from "../domain/types";

/** Group key for holdings with no recorded account/platform (#12). */
export const ACCOUNT_UNASSIGNED = "__unassigned__";

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

/**
 * 资产位置敞口 rows（#12）：account 是 *交易* 属性，同一资产可分散在多个账户/平台，
 * 故按净份额比例把该资产的报告货币市值拆分到各账户。net shares per (asset, account)
 * 用 BUY(+)/SELL(−)（对齐 returns/twr.ts `computeSharesAt`，忽略 DIVIDEND/SPLIT/
 * ADJUSTMENT）。拆分分母用各账户*正*净份额之和（负净额账户视为不持有、剔除），故各
 * 账户值精确对账到该资产市值。无 account 的交易归入 `ACCOUNT_UNASSIGNED`；某资产无份额
 * 信息（无交易或净额 ≤0）则整额归 unassigned，仍可对账（不变性 2：持仓=Σ交易）。
 */
const accountExposureRows = (
  perAsset: ReadonlyArray<MarketValuation>,
  transactions: ReadonlyArray<Transaction>
): Array<{ group: string; assetId: string; value: Decimal }> => {
  const byAsset = new Map<string, { total: Decimal; byAccount: Map<string, Decimal> }>();
  for (const tx of transactions) {
    if (tx.type !== "BUY" && tx.type !== "SELL") continue;
    const signed = tx.type === "BUY" ? tx.shares : tx.shares.negated();
    const account = tx.account && tx.account.length > 0 ? tx.account : ACCOUNT_UNASSIGNED;
    const entry = byAsset.get(tx.assetId) ?? { total: new Decimal(0), byAccount: new Map() };
    entry.total = entry.total.plus(signed);
    entry.byAccount.set(account, (entry.byAccount.get(account) ?? new Decimal(0)).plus(signed));
    byAsset.set(tx.assetId, entry);
  }

  const rows: Array<{ group: string; assetId: string; value: Decimal }> = [];
  for (const v of perAsset) {
    const entry = byAsset.get(v.assetId);
    if (!entry || entry.total.lessThanOrEqualTo(0)) {
      rows.push({ group: ACCOUNT_UNASSIGNED, assetId: v.assetId, value: v.valueReporting });
      continue;
    }
    // Prorate by each account's *positive* net shares, using the sum of positive
    // shares (not entry.total) as the denominator. A net-negative account (e.g. an
    // import/over-sell artifact) can't hold a fraction of the asset, so it is
    // dropped — but entry.total nets it out, which would push the positive accounts'
    // fractions past 1 and over-allocate the asset's value. positiveTotal keeps the
    // per-account values reconciling exactly to v.valueReporting.
    let positiveTotal = new Decimal(0);
    for (const shares of entry.byAccount.values()) {
      if (shares.greaterThan(0)) positiveTotal = positiveTotal.plus(shares);
    }
    if (positiveTotal.lessThanOrEqualTo(0)) {
      rows.push({ group: ACCOUNT_UNASSIGNED, assetId: v.assetId, value: v.valueReporting });
      continue;
    }
    for (const [account, shares] of entry.byAccount) {
      if (shares.lessThanOrEqualTo(0)) continue;
      rows.push({
        group: account,
        assetId: v.assetId,
        value: v.valueReporting.times(shares).dividedBy(positiveTotal),
      });
    }
  }
  return rows;
};

/** 资产位置敞口（按账户/平台分组）。 */
export const accountExposure = (
  perAsset: ReadonlyArray<MarketValuation>,
  transactions: ReadonlyArray<Transaction>
): ReadonlyArray<ExposureSlice<string>> =>
  aggregateExposure(
    accountExposureRows(perAsset, transactions).map((r) => ({ group: r.group, value: r.value }))
  );

/** 资产位置敞口明细（含组内资产，用于详情页可展开图例）。 */
export const accountExposureBreakdown = (
  perAsset: ReadonlyArray<MarketValuation>,
  transactions: ReadonlyArray<Transaction>
): ReadonlyArray<ExposureGroupBreakdown<string>> =>
  breakdownBy(accountExposureRows(perAsset, transactions));
