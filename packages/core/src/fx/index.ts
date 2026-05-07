/**
 * fx — 多币种换算
 *
 * CLAUDE.md §3.2.4：币种永不丢失；显示时按报告货币换算；存储绝不预先换算。
 *
 * Stage 1 实施 `convert` 即可（USD ↔ CNY 双向）；Stage 2 扩展更多货币 + 历史汇率链路。
 */

import Decimal from "decimal.js";
import type { Currency, FxRate } from "../domain/types";

/**
 * convert — 把金额从 from 币种换算到 to 币种
 *
 * @stub Stage 1 实施
 */
export const convert = (
  _amount: Decimal,
  _from: Currency,
  _to: Currency,
  _fxRates: ReadonlyArray<FxRate>,
): Decimal => {
  throw new Error("convert: not yet implemented (Stage 1 task)");
};

/**
 * findRate — 在 fxRates 池中找到 from→to 的汇率（包括反向倒数）
 *
 * @stub Stage 1 实施
 */
export const findRate = (
  _from: Currency,
  _to: Currency,
  _fxRates: ReadonlyArray<FxRate>,
): FxRate | null => {
  throw new Error("findRate: not yet implemented (Stage 1 task)");
};

/**
 * 占位：1:1（同币种），便于业务侧 short-circuit
 */
export const ONE_TO_ONE = new Decimal(1);
