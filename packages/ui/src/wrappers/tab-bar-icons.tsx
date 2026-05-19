/**
 * tab-bar-icons.ts — Outline / filled pairs for the floating tab bar (ADR 006 T1).
 *
 * Lucide is stroke-only and has no first-class filled variants, so tab-bar icons
 * use Ionicons via @expo/vector-icons (already pulled in by Expo). Business code
 * never imports vector-icons directly — only <TabBarIcon /> from `@arc/ui`.
 *
 * Stage 2+ list rows / empty states can stay on Lucide (wrappers/icons.ts).
 */

import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export interface TabBarIconPair {
  outline: IoniconName;
  filled: IoniconName;
}

/** Expo Router `(tabs)` route name → Ionicons outline/filled pair. */
export const TAB_BAR_ICON_PAIRS: Record<string, TabBarIconPair> = {
  index: { outline: "pie-chart-outline", filled: "pie-chart" },
  markets: { outline: "trending-up-outline", filled: "trending-up" },
  insights: { outline: "bulb-outline", filled: "bulb" },
};

export interface TabBarIconProps {
  routeName: string;
  focused: boolean;
  size?: number;
}

export function TabBarIcon({ routeName, focused, size = 22 }: TabBarIconProps) {
  const pair = TAB_BAR_ICON_PAIRS[routeName];
  // ADR 008 §决策三 (修订 2026-05-19): active tab uses solid bg-accent pill,
  // so icon must use accent-foreground (eclipse near-black in both modes) for
  // high contrast against the bright green fill. crypto-wallet / Wise pattern.
  const [accentForeground, muted] = useThemeColor(["accent-foreground", "muted"]);

  if (pair === undefined) {
    return null;
  }

  const name = focused ? pair.filled : pair.outline;
  const color = focused ? accentForeground : muted;

  return <Ionicons name={name} size={size} color={color} />;
}
