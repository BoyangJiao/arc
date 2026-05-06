/**
 * Text — 受主题感知的基础文本原语
 *
 * 业务代码禁止直接 `import { Text } from 'react-native'`，应当用 `import { Text } from '@arc/ui'`。
 * 默认套用 HeroUI 的 `text-foreground` token，确保深色 Card 上对比度正确。
 *
 * Spike 已识别问题：裸 RN <Text> 在 HeroUI 深色 Card 上对比度不足。详见 ADR 002 spike 记录。
 */

import { forwardRef } from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";

export type TextProps = RNTextProps;

export const Text = forwardRef<RNText, TextProps>(function Text(
  { className, ...rest },
  ref,
) {
  // Uniwind 通过 className prop 注入样式；默认色用 HeroUI 的 foreground token。
  // 业务方传入的 className 会覆盖默认（Tailwind 后写优先）。
  const merged = ["text-foreground", className].filter(Boolean).join(" ");
  return <RNText ref={ref} className={merged} {...rest} />;
});
