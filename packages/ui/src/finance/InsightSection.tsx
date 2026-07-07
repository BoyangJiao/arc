/**
 * InsightSection — Insights 模块统一区块布局（Delta / Wise pattern）。
 *
 * 标题文字独立成行、不包卡；内容模块包卡。所有 Insights 卡（敞口 / 再平衡 /
 * 盈亏 / 基准…）共用此结构，保证视觉一致。
 *
 *   标题  [PRO]               ⟵ headerRight
 *   副标题
 *   ┌───────────────────────┐
 *   │  children（content）  │  ⟵ Card
 *   └───────────────────────┘
 */

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { TYPO_OVERLINE, TYPO_SECTION_TITLE } from "../tokens/typography";

import { InsightTierBadge, type InsightTier } from "./InsightTierBadge";

export interface InsightSectionProps {
  readonly title: string;
  /** 标题下方小字（如报告货币） */
  readonly subtitle?: string;
  /** 目标档位 — 非 free 时标题后渲染 PRO / PRO+ 徽章 */
  readonly tier?: InsightTier;
  /** 标题后内联元素（如 ⓘ tooltip 按钮） */
  readonly titleAccessory?: ReactNode;
  /** 标题行最右侧（如 active chip） */
  readonly headerRight?: ReactNode;
  readonly children: ReactNode;
  /**
   * Card body 内层 className，默认 `gap-5`。
   * 注意：不要在这里加 padding —— HeroUI `Card`(extends `Surface`) 默认已带 `p-4`(16px)。
   */
  readonly bodyClassName?: string;
  /** 设置后整张内容卡可点击（标题行右侧自动出现 chevron 指示） */
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
}

export function InsightSection({
  title,
  subtitle,
  tier = "free",
  titleAccessory,
  headerRight,
  children,
  bodyClassName = "gap-5",
  onPress,
  accessibilityLabel,
}: InsightSectionProps): ReactNode {
  const body = <View className={bodyClassName}>{children}</View>;

  return (
    <View className="gap-3">
      <View className="gap-0.5 px-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2 flex-1 min-w-0">
            <Text className={TYPO_SECTION_TITLE} numberOfLines={1}>
              {title}
            </Text>
            <InsightTierBadge tier={tier} />
            {titleAccessory}
          </View>
          {headerRight ? <View className="shrink-0">{headerRight}</View> : null}
        </View>
        {subtitle ? <Text className={TYPO_OVERLINE}>{subtitle}</Text> : null}
      </View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          className="active:opacity-70"
        >
          <Card>{body}</Card>
        </Pressable>
      ) : (
        <Card>{body}</Card>
      )}
    </View>
  );
}
