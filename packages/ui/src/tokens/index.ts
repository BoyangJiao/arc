/**
 * tokens/ — 设计 token 单一真相源
 *
 * 当前状态：**占位**。目前业务/UI 直接使用 HeroUI Native 默认 token
 * （bg-background / text-foreground / bg-card 等），在 global.css 中由
 * `heroui-native/styles` 注入。
 *
 * 待办（未来由用户/Claude 完成）：
 * 1. 颜色：定义 brand / accent / semantic（gain/loss/warning/info）
 * 2. 涨跌色切换：semantic.gain/loss 接入 useColorScheme + 用户偏好
 *    （CLAUDE.md §六：支持「红涨绿跌」与「绿涨红跌」两套，禁止硬编码颜色值）
 * 3. 字号、间距、圆角的语义层（避免业务里出现 text-2xl / p-4 这样的散值）
 *
 * 完成后业务代码改为：
 *   import { semanticTokens } from '@arc/ui';
 *   const gainColor = semanticTokens[theme].gain[colorScheme];
 */

export type SemanticTheme = "redUpGreenDown" | "greenUpRedDown";
export type ColorScheme = "light" | "dark";

// 占位常量。真实实现见上方 TODO。
export const DEFAULT_THEME: SemanticTheme = "redUpGreenDown";
