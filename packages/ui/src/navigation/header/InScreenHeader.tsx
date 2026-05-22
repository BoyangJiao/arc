/**
 * InScreenHeader — in-page header for modal / secondary screens (ADR 008 Batch 3).
 *
 * 替代 React Navigation stack header 的场景：
 *   - Modal / formSheet / sheet 类页面（避免 React Navigation modal header 与 body
 *     不同色产生的"叠层"视觉，以及状态栏区域的白条 bug — 截图 4/5）
 *   - me/* 等二级页面（iOS 26+ 的 native back chevron 圆形描边在 stack header
 *     里渲染突兀；in-screen 完全自有 styling）
 *
 * 设计原则（参考 crypto-wallet 的 wallet-header）：
 *   1. 不依赖 React Navigation header；由 Screen 内部第一个子节点充当
 *   2. 与 Screen 的 bg-background 同色 → 无"叠层"
 *   3. 状态栏区域由 Screen 的 paddingTop:insets.top 自动着色 → 无白条
 *   4. 三槽布局 left / title / right，左右等宽保证 title 视觉居中
 *
 * 使用：
 *   <Screen>
 *     <InScreenHeader title={t("title")} leftType="close" rightSlot={<SaveBtn />} />
 *     <ScreenContent>...</ScreenContent>
 *   </Screen>
 *
 * 配合 Stack.Screen options={{ headerShown: false }}（在父 _layout 或 screen 内）。
 */

import { type ReactNode } from "react";
import { View } from "react-native";

import { cn } from "../../primitives";
import { Text } from "../../primitives/Text";
import { TYPO_TITLE } from "../../tokens/typography";
import { HeaderBackButton, HeaderCloseButton } from "./HeaderAtoms";

export type InScreenHeaderLeftType = "back" | "close" | "none";

export interface InScreenHeaderProps {
  /** Title 居中显示。可省略（如品牌页或纯操作页）。 */
  title?: string;
  /** Left slot 类型：`back` = chevron 返回，`close` = X 关闭，`none` = 无 */
  leftType?: InScreenHeaderLeftType;
  /** Left 按钮点击。若省略，使用 router.back()（HeaderBackButton/CloseButton 内置）。 */
  leftOnPress?: () => void;
  /**
   * 自定义 left slot — 完全覆盖 leftType。用于需要特殊 left action 的少数页面。
   */
  leftSlot?: ReactNode;
  /**
   * Right slot — 通常是 <Button size="sm">、<LinkButton> 或 icon-only Pressable。
   * 设计上鼓励使用 HeroUI Button variant="primary" size="sm" 以保持 CTA 视觉一致。
   */
  rightSlot?: ReactNode;
  /**
   * Vertical rhythm: `default` = 44pt compact bar; `comfortable` = extra padding for
   * modal / bottom-sheet style screens (search sheet, etc.).
   */
  density?: "default" | "comfortable";
}

/** Left/right slot 的固定宽度。保证 title 视觉居中，与 React Navigation header 习惯一致。 */
const SLOT_WIDTH = 64;

/** iOS standard navigation bar content height (HIG). */
const HEADER_HEIGHT = 44;

/** Modal / sheet — slightly taller bar + vertical padding for breathing room. */
const HEADER_COMFORTABLE_MIN_HEIGHT = 52;
const HEADER_COMFORTABLE_PADDING_V = 10;

export function InScreenHeader({
  title,
  leftType = "back",
  leftOnPress,
  leftSlot,
  rightSlot,
  density = "default",
}: InScreenHeaderProps) {
  const left =
    leftSlot ??
    (leftType === "back" ? (
      <HeaderBackButton onPress={leftOnPress} />
    ) : leftType === "close" ? (
      <HeaderCloseButton onPress={leftOnPress} />
    ) : null);

  const isComfortable = density === "comfortable";

  return (
    <View
      className={cn("flex-row items-center justify-center px-2", isComfortable && "mb-3")}
      style={
        isComfortable
          ? {
              minHeight: HEADER_COMFORTABLE_MIN_HEIGHT,
              paddingVertical: HEADER_COMFORTABLE_PADDING_V,
            }
          : { height: HEADER_HEIGHT }
      }
      accessibilityRole="header"
    >
      <View style={{ width: SLOT_WIDTH }} className="items-start justify-center">
        {left}
      </View>
      <View className="flex-1 items-center justify-center px-2">
        {title ? (
          <Text className={TYPO_TITLE} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      <View style={{ width: SLOT_WIDTH }} className="items-end justify-center">
        {rightSlot}
      </View>
    </View>
  );
}
