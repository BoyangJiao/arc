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
import { Pressable, type PressableProps } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "../../primitives/Text";
import { ChevronLeft, X, type LucideIcon } from "../../wrappers/icons";

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
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={pressableHitSlot}
    >
      <ChevronLeft size={26} className="text-accent" />
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Atom: HeaderCloseButton — left-side X for modals / form sheets

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
  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={pressableHitSlot}
    >
      <X size={22} className="text-accent" />
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Atom: HeaderActionButton — right-side icon button (AI entry, filter, etc.)

export interface HeaderActionButtonProps {
  /** Lucide icon (from @arc/ui wrappers/icons). */
  icon: LucideIcon;
  onPress: PressableProps["onPress"];
  accessibilityLabel: string;
  /** Icon size in px. Default 22. */
  size?: number;
}

export function HeaderActionButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  size = 22,
}: HeaderActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={pressableHitSlot}
    >
      <Icon size={size} className="text-foreground" />
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Atom: HeaderTextButton — left or right side text-only button (e.g. "Cancel")

export interface HeaderTextButtonProps {
  label: string;
  onPress: PressableProps["onPress"];
  /** "accent" for primary (default), "muted" for secondary */
  emphasis?: "accent" | "muted";
}

export function HeaderTextButton({ label, onPress, emphasis = "accent" }: HeaderTextButtonProps) {
  const color = emphasis === "accent" ? "text-accent" : "text-muted";
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={pressableHitSlot}
    >
      <Text className={`${color} text-base`}>{label}</Text>
    </Pressable>
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

// ──────────────────────────────────────────────────────────────────────────
// Internal

const pressableHitSlot = { paddingHorizontal: 8, paddingVertical: 6 };
