/**
 * Header Atoms — composable building blocks for React Navigation Stack headers.
 *
 * Per ADR 006 §决策五: do NOT build a `<TopBar>` component. Instead, provide
 * small atoms that get injected into React Navigation's `headerLeft` /
 * `headerRight` / `headerTitle` slots. React Navigation keeps owning the
 * container (safe area, blur, large-title fold, transitions); we only own
 * what goes inside the slots.
 *
 * Usage:
 *   <Stack.Screen
 *     options={{
 *       title: "My Portfolio",
 *       headerLeft: () => <HeaderBackButton />,
 *       headerRight: () => <HeaderActionButton icon={Bell} onPress={...} />,
 *     }}
 *   />
 *
 * Or via the convenience hook:
 *   <Stack.Screen options={useStackScreenOptions({ title, backType: "chevron" })} />
 */

import { useMemo } from "react";
import { type PressableProps } from "react-native";
import { useRouter } from "expo-router";

import { useThemeColor } from "heroui-native";

import { CloseButton, LinkButton } from "../../primitives";
import { CaretLeftIcon, type PhosphorIcon } from "../../wrappers/icons";
import { ThemedIcon } from "../../wrappers/themed-icon";

// ──────────────────────────────────────────────────────────────────────────
// Atom: HeaderBackButton — left-side chevron back

export interface HeaderBackButtonProps {
  /** Custom press handler. Defaults to `router.back()`. */
  onPress?: () => void;
  /** Accessibility label. Defaults to "Back". */
  accessibilityLabel?: string;
}

export function HeaderBackButton({ onPress, accessibilityLabel = "Back" }: HeaderBackButtonProps) {
  const router = useRouter();
  const handlePress = onPress ?? (() => router.back());
  return (
    <LinkButton isIconOnly onPress={handlePress} accessibilityLabel={accessibilityLabel}>
      <ThemedIcon icon={CaretLeftIcon} size={22} weight="bold" />
    </LinkButton>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Atom: HeaderCloseButton — left-side X for modals / form sheets
// 2026-05-19 Batch 2: 改用 OSS CloseButton（tertiary variant + size=sm + isIconOnly），
// 自带 themed pill 背景，比原 raw Pressable 更醒目可触。

export interface HeaderCloseButtonProps {
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function HeaderCloseButton({
  onPress,
  accessibilityLabel = "Close",
}: HeaderCloseButtonProps) {
  const router = useRouter();
  const handlePress = onPress ?? (() => router.back());
  const foreground = useThemeColor("foreground");
  return (
    <CloseButton
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel}
      iconProps={{ color: foreground, size: 22 }}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Atom: HeaderActionButton — right-side icon button (AI entry, filter, etc.)

export interface HeaderActionButtonProps {
  /** Lucide icon (from @arc/ui wrappers/icons). */
  icon: PhosphorIcon;
  onPress: PressableProps["onPress"];
  accessibilityLabel: string;
  /** Icon size in px. Default 22. */
  size?: number;
  /**
   * Phosphor icon weight. Default "regular" (outline). Use "fill" to convey
   * active / selected state (e.g. star toggled in watchlist).
   */
  weight?: "regular" | "fill" | "bold" | "duotone" | "light" | "thin";
  /** HeroUI semantic color token. Default "foreground". */
  colorToken?: "foreground" | "muted" | "accent" | "accent-foreground";
}

export function HeaderActionButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  size = 22,
  weight = "regular",
  colorToken = "foreground",
}: HeaderActionButtonProps) {
  return (
    <LinkButton isIconOnly onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <ThemedIcon icon={Icon} size={size} weight={weight} colorToken={colorToken} />
    </LinkButton>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Atom: HeaderTextButton — left or right side text-only button (e.g. "Cancel")
// 2026-05-19 Batch 2: 改用 OSS LinkButton（ghost variant 内部强制），
// 颜色由 theme token 决定，主行动用 text-accent (allowed per ADR-008 §决策一第 1 项 — 主行动按钮)。

export interface HeaderTextButtonProps {
  label: string;
  onPress: PressableProps["onPress"];
  /** "accent" for primary action (default — e.g. Save / Done), "muted" for secondary (e.g. Cancel) */
  emphasis?: "accent" | "muted";
}

export function HeaderTextButton({ label, onPress, emphasis = "accent" }: HeaderTextButtonProps) {
  const labelClass = emphasis === "accent" ? "text-accent" : "text-muted";
  return (
    <LinkButton onPress={onPress} accessibilityLabel={label}>
      <LinkButton.Label className={`${labelClass} text-base`}>{label}</LinkButton.Label>
    </LinkButton>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Hook: useStackScreenOptions — convenience builder for Stack.Screen options
//
// Stage 1 keeps this thin — just back-type wiring + title pass-through.
// Future expansion (right action, search bar, large title) lives here so
// every Stack screen has a single declarative call.

export type BackType = "none" | "chevron" | "close";

export interface UseStackScreenOptionsArgs {
  title?: string;
  backType?: BackType;
  /** Optional element for the right slot (e.g. <HeaderActionButton .../>). */
  headerRight?: React.ReactNode;
  /** Override hide of the entire header (e.g. for full-screen onboarding). */
  headerShown?: boolean;
}

export function useStackScreenOptions(args: UseStackScreenOptionsArgs) {
  const { title, backType = "chevron", headerRight, headerShown = true } = args;

  return useMemo(() => {
    const left =
      backType === "chevron" ? (
        <HeaderBackButton />
      ) : backType === "close" ? (
        <HeaderCloseButton />
      ) : null;

    return {
      headerShown,
      title,
      headerLeft: left ? () => left : undefined,
      headerRight: headerRight ? () => headerRight : undefined,
    };
  }, [title, backType, headerRight, headerShown]);
}
