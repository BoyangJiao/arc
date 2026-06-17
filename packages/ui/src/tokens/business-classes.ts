/**
 * Business token → Tailwind v4 字面量 className 映射
 *
 * 为什么不用模板字符串拼接（如 ``bg-${tokens.gain}``）：
 *   Tailwind v4 在编译期扫描源码字符串以决定生成哪些 utility 类。
 *   动态拼接 → 编译器看不到完整 class 名 → 生成的 CSS 缺少该类 → 运行时无样式。
 *
 * 解法：把所有可能的字面量 className 在此文件里写死。
 *   编译器扫描到 `bg-success-soft` 等字面量 → 正确生成 CSS。
 *   业务代码通过 useBusinessClasses() 拿到字面量 className，零拼接。
 *
 * 见 https://tailwindcss.com/docs/detecting-classes-in-source-files
 */

import type { BusinessTokenMap, FinanceColorMode } from "./business";

/** Business token 在某种模式下的 4 个常用 className 变体 */
export interface BusinessClassSet {
  /** 单色文字 / 图标，如 PnL 数字本身 */
  readonly text: string;
  /** 实心背景，如强调态徽章 */
  readonly bg: string;
  /** 弱化背景（透明度 15%）— 最常用的 PnL 徽章背景 */
  readonly bgSoft: string;
  /** 弱化背景上的字色 — 与 bgSoft 配对 */
  readonly textOnSoft: string;
}

export interface BusinessClassMap {
  readonly gain: BusinessClassSet;
  readonly loss: BusinessClassSet;
  readonly pnlNeutral: Pick<BusinessClassSet, "text">;
  readonly deviationWarning: Pick<BusinessClassSet, "bg" | "bgSoft" | "textOnSoft">;
  readonly deviationCritical: Pick<BusinessClassSet, "bg" | "bgSoft" | "textOnSoft">;
}

// ── 各模式下的字面量 className 表（Tailwind v4 编译器可扫描）────────────

const SUCCESS_CLASSES: BusinessClassSet = {
  text: "text-success",
  bg: "bg-success",
  bgSoft: "bg-success-soft",
  textOnSoft: "text-success",
};

const DANGER_CLASSES: BusinessClassSet = {
  text: "text-danger",
  bg: "bg-danger",
  bgSoft: "bg-danger-soft",
  textOnSoft: "text-danger",
};

const SHARED_NEUTRAL = {
  pnlNeutral: { text: "text-muted" },
  deviationWarning: {
    bg: "bg-warning",
    bgSoft: "bg-warning-soft",
    textOnSoft: "text-warning",
  },
  deviationCritical: {
    bg: "bg-danger",
    bgSoft: "bg-danger-soft",
    textOnSoft: "text-danger",
  },
} as const;

const CLASS_MAP_BY_MODE: Record<FinanceColorMode, BusinessClassMap> = {
  greenUpRedDown: {
    gain: SUCCESS_CLASSES,
    loss: DANGER_CLASSES,
    ...SHARED_NEUTRAL,
  },
  redUpGreenDown: {
    gain: DANGER_CLASSES,
    loss: SUCCESS_CLASSES,
    ...SHARED_NEUTRAL,
  },
} as const;

/**
 * 由用户偏好取 className 字面量表
 *
 * @example
 *   const classes = buildBusinessClasses('greenUpRedDown');
 *   <Text className={classes.gain.text}>+2.3%</Text>   // → text-success
 *   <View className={classes.gain.bgSoft}>            // → bg-success-soft
 */
export const buildBusinessClasses = (mode: FinanceColorMode): BusinessClassMap =>
  CLASS_MAP_BY_MODE[mode];

/**
 * 反向工具：由 BusinessTokenMap 拿对应 ClassSet（gain/loss 用）
 *
 * 当你已经持有 tokens（如来自 useBusinessTokens）但需要 className 时使用。
 */
export const tokenToClasses = (
  token: BusinessTokenMap["gain"] | BusinessTokenMap["loss"]
): BusinessClassSet => (token === "success" ? SUCCESS_CLASSES : DANGER_CLASSES);
