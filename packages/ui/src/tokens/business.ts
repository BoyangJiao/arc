/**
 * Business tokens — Arc 业务领域 token 层（ADR 003 v3.1 §决策四 / §决策五）
 *
 * 与 HeroUI Foundation 平行，**全部映射到 Foundation**（不直接引 Primitive）。
 *
 * 业务消费规则（ADR 003 v3.1 §决策二）：
 *   - 「这是 UI 元素」（按钮 / 卡片 / 文字 / 边框）→ 用 HeroUI Foundation 名（bg-surface / text-foreground 等）
 *   - 「这是业务数据」（涨幅 / 跌幅 / 偏离）→ 用 Business 名（text-gain / bg-loss-soft 等）
 *
 * 红涨绿跌切换（ADR 003 v3.1 §决策五）：
 *   Foundation `success` 永远绿、`danger` 永远红；
 *   Business `gain` 根据用户 `financeColorMode` 偏好映射到 success 或 danger。
 *
 * 不在本文件 :
 *   - JSX / Provider / Context — 见 `business-context.tsx`
 *   - Tailwind 字面量 className 映射 — 见 `business-classes.ts`
 */

// ── 用户偏好 ──────────────────────────────────────────────────────────────

/** 涨跌色偏好（与 packages/core domain.FinanceColorMode 对齐）*/
export type FinanceColorMode = "redUpGreenDown" | "greenUpRedDown";

/** 默认偏好 — 与 packages/db user_preferences DEFAULT 对齐 */
export const DEFAULT_FINANCE_COLOR_MODE: FinanceColorMode = "greenUpRedDown";

// ── Foundation token 名（窄类型，避免误用）───────────────────────────────

/** HeroUI Foundation 中的 status token（Business 可映射到的目标）*/
export type FoundationStatusToken = "success" | "danger" | "warning" | "muted";

/** HeroUI Foundation 中的 soft 派生 token */
export type FoundationSoftToken = "success-soft" | "danger-soft" | "warning-soft";

// ── Business token 映射表 ────────────────────────────────────────────────

export interface BusinessTokenMap {
  /** 涨幅（正 PnL）— 默认绿、红涨绿跌偏好下变红 */
  gain: Extract<FoundationStatusToken, "success" | "danger">;
  /** 跌幅（负 PnL）— gain 的反色 */
  loss: Extract<FoundationStatusToken, "success" | "danger">;
  /** 中性 PnL（0 或未知）— 永远 muted（不分涨跌偏好）*/
  pnlNeutral: Extract<FoundationStatusToken, "muted">;
  /** 偏离目标 5-10% — warning-soft */
  deviationWarning: Extract<FoundationSoftToken, "warning-soft">;
  /** 偏离目标 >10% — danger-soft */
  deviationCritical: Extract<FoundationSoftToken, "danger-soft">;
}

/**
 * 由用户偏好构造 Business token 映射表（纯函数，可测试）
 *
 * @example
 *   buildBusinessTokens('greenUpRedDown')
 *   // → { gain: 'success', loss: 'danger', pnlNeutral: 'muted', ... }
 *
 *   buildBusinessTokens('redUpGreenDown')
 *   // → { gain: 'danger', loss: 'success', ... }
 */
export const buildBusinessTokens = (mode: FinanceColorMode): BusinessTokenMap => ({
  gain: mode === "redUpGreenDown" ? "danger" : "success",
  loss: mode === "redUpGreenDown" ? "success" : "danger",
  pnlNeutral: "muted",
  deviationWarning: "warning-soft",
  deviationCritical: "danger-soft",
});
