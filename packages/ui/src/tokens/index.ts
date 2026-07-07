/**
 * tokens/ — Arc 设计 token 公共 API
 *
 * 架构（详见 docs/adr/003-design-tokens.md v3.1）：
 *   - **Primitive**（apps/mobile/global.css `@theme` 块）— 7 OKLCH 色阶 + 4 常量 + sizing
 *   - **Foundation**（HeroUI Native 26 + Pro 5 + Arc 扩 7 = 38）— 通过 var() 引用 Primitive
 *   - **Business**（本文件）— 5 业务 token + 派生，全部映射到 Foundation
 *   - **Component** — 业务代码消费层
 *
 * 业务消费规则（ADR 003 v3.1 §决策二，黑白分明）：
 *   - 「这是 UI 元素」→ 用 HeroUI Foundation className（bg-surface / text-foreground / bg-accent ...）
 *   - 「这是业务数据」（涨跌 / 偏离）→ 用 useBusinessClasses() 拿字面量 className
 *
 * Stage 1 速查（详见 docs/adr/003-design-tokens.md 附录 A）：
 *   - 页面背景：bg-background
 *   - 卡片背景：bg-surface
 *   - 主文字：text-foreground
 *   - 次文字：text-muted
 *   - 链接 / 强调：text-accent
 *   - 主按钮：bg-accent text-accent-foreground
 *   - 涨跌徽章：useBusinessClasses() → classes.gain / classes.loss
 */

// Business token 类型 + 纯函数（可在非 React 环境用，如服务端 / 测试）
export {
  buildBusinessTokens,
  DEFAULT_FINANCE_COLOR_MODE,
  type BusinessTokenMap,
  type FinanceColorMode,
  type FoundationStatusToken,
  type FoundationSoftToken,
} from "./business";

// Business className 字面量映射
export {
  buildBusinessClasses,
  tokenToClasses,
  type BusinessClassMap,
  type BusinessClassSet,
} from "./business-classes";

// React Context + hooks
export {
  BusinessTokensProvider,
  useBusinessTokens,
  useBusinessClasses,
  useFinanceColorMode,
  type BusinessTokensProviderProps,
} from "./business-context";

// Categorical chart palette (SVG stroke/fill — single source, ADR 006 charts/)
export { CHART_CATEGORICAL_PALETTE, chartCategoricalColor } from "./chart-palette";

// Navigation color values (for React Navigation style APIs that don't support className)
export {
  NAVIGATION_COLORS,
  TAB_BAR_COLORS,
  type NavigationColorSet,
  type TabBarColorSet,
} from "./navigation-colors";

// Semantic typography (specs + pre-built class strings)
export {
  typography,
  typographySpecs,
  typographySpecToClassName,
  typographyClass,
  TYPO_DISPLAY,
  TYPO_DISPLAY_2XL,
  TYPO_DISPLAY_3XL,
  TYPO_SECTION_TITLE,
  TYPO_TITLE_LG,
  TYPO_TITLE,
  TYPO_LABEL,
  TYPO_METRIC,
  TYPO_METRIC_SM,
  TYPO_BODY,
  TYPO_BODY_SM,
  TYPO_BODY_MEDIUM,
  TYPO_SYMBOL,
  TYPO_ROW_TITLE,
  TYPO_ROW_VALUE,
  TYPO_CHANGE_LG,
  TYPO_CHANGE_MD,
  TYPO_CHANGE_AMOUNT,
  TYPO_BADGE_SM,
  TYPO_BADGE_MD,
  TYPO_CAPTION,
  TYPO_CAPTION_FOREGROUND,
  TYPO_CAPTION_MEDIUM,
  TYPO_CONTROL_LABEL,
  TYPO_OVERLINE,
  TYPO_EMPTY_MESSAGE,
  TYPO_DISCLAIMER,
  TYPO_FIELD_LABEL,
  TYPO_DANGER,
  TYPO_DANGER_SM,
  TYPO_AVATAR_MONOGRAM,
  TYPO_AVATAR_BADGE,
  TYPO_CHIP_STATUS,
  type TypographyRole,
  type TypographySpec,
  type TypographyFontSize,
  type TypographyFontWeight,
  type TypographyColor,
  type TypographyLineHeight,
  type TypographyLetterSpacing,
  type TypographyFontFamily,
} from "./typography";
