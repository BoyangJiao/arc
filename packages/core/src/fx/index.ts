/**
 * fx — 多币种换算
 *
 * CLAUDE.md §3.2.4：币种永不丢失；显示时按报告货币换算；存储绝不预先换算。
 *
 * `findRate` 是全项目 FX 查找的单一实现（含反向汇率倒数回退），
 * valuation / snapshot 等消费方不得各自实现查找逻辑（避免语义漂移）。
 *
 * 关键语义：**查不到汇率必须返回 null，调用方必须显式处理缺失** —
 * 绝不允许静默按 1:1 处理跨币种金额（这是铁律 4 的实质性破坏）。
 */

import Decimal from "decimal.js";
import type { Currency, FxRate } from "../domain/types";

/** 占位：1:1（同币种），便于业务侧 short-circuit */
export const ONE_TO_ONE = new Decimal(1);

/**
 * findRate — 在 fxRates 池中找到 from→to 的汇率
 *
 * 查找顺序：
 *   1. from === to → 恒等汇率（rate=1，source="identity"）
 *   2. 直接匹配 from→to（同 pair 多条时取 asOf 最新）
 *   3. 反向匹配 to→from → 取倒数（source 带 ":inverse" 后缀便于审计）
 *   4. 都没有 → null（调用方必须显式处理，禁止静默 1:1）
 */
export const findRate = (
  from: Currency,
  to: Currency,
  fxRates: ReadonlyArray<FxRate>
): FxRate | null => {
  if (from === to) {
    return {
      from,
      to,
      rate: ONE_TO_ONE,
      asOf: new Date().toISOString(),
      source: "identity",
    };
  }

  let direct: FxRate | null = null;
  let inverse: FxRate | null = null;
  for (const r of fxRates) {
    if (r.from === from && r.to === to) {
      if (!direct || r.asOf > direct.asOf) direct = r;
    } else if (r.from === to && r.to === from) {
      if (!inverse || r.asOf > inverse.asOf) inverse = r;
    }
  }

  if (direct) return direct;

  if (inverse && !inverse.rate.isZero()) {
    return {
      from,
      to,
      rate: new Decimal(1).dividedBy(inverse.rate),
      asOf: inverse.asOf,
      source: `${inverse.source}:inverse`,
    };
  }

  return null;
};

/**
 * convert — 把金额从 from 币种换算到 to 币种
 *
 * @returns 换算后的金额；找不到汇率时返回 null（调用方必须显式处理）
 */
export const convert = (
  amount: Decimal,
  from: Currency,
  to: Currency,
  fxRates: ReadonlyArray<FxRate>
): Decimal | null => {
  const rate = findRate(from, to, fxRates);
  return rate ? amount.times(rate.rate) : null;
};
