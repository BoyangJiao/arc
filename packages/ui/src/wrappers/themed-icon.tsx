/**
 * ThemedIcon — Phosphor icons with HeroUI runtime theme colors.
 *
 * Replaces ThemedLucideIcon (Lucide className did not re-resolve on color-mode toggle).
 * Tab bar continues to use Ionicons via TabBarIcon + useThemeColor.
 */

import type { IconProps } from "phosphor-react-native";
import { View } from "react-native";
import { useThemeColor } from "heroui-native";

import type { PhosphorIcon } from "./icons";

type ThemeColorToken = "foreground" | "muted" | "accent" | "accent-foreground";

export interface ThemedIconProps {
  icon: PhosphorIcon;
  size?: number;
  /** HeroUI semantic color token (resolved at runtime). */
  colorToken?: ThemeColorToken;
  weight?: IconProps["weight"];
  accessibilityLabel?: string;
}

export function ThemedIcon({
  icon: IconComponent,
  size = 24,
  colorToken = "foreground",
  weight = "regular",
  accessibilityLabel,
}: ThemedIconProps) {
  const color = useThemeColor(colorToken);

  const icon = <IconComponent size={size} color={color} weight={weight} />;

  if (accessibilityLabel === undefined) {
    return icon;
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      {icon}
    </View>
  );
}

/** @deprecated Use ThemedIcon */
export const ThemedLucideIcon = ThemedIcon;
/** @deprecated Use ThemedIconProps */
export type ThemedLucideIconProps = ThemedIconProps;
