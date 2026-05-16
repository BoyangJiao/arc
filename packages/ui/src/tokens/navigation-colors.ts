/**
 * navigation-colors.ts — Raw color values for React Navigation theming.
 *
 * React Navigation (Stack / Tabs) styling APIs require literal color strings;
 * they do NOT support Tailwind className. This file maps Foundation tokens to
 * raw hex values consumed exclusively by navigation configuration.
 *
 * Keep values in sync with global.css `@layer theme` Foundation overrides.
 * Any Foundation token change must be mirrored here.
 *
 * NOTE: This file is exempted from the no-hardcoded-color lint rule
 * (packages/ui/src/tokens/** is in the ESLint ignores list).
 */

export interface NavigationColorSet {
  /** Screen content background (maps to --background) */
  background: string;
  /** Header / Tab-bar background (maps to --surface) */
  card: string;
  /** Header title + icon tint (maps to --foreground) */
  text: string;
  /** Header / Tab-bar border (maps to --border) */
  border: string;
}

/**
 * Tab bar-specific colors for the floating capsule tab bar.
 * These are consumed by FloatingTabBar which uses StyleSheet (not className)
 * and therefore needs raw color values.
 */
export interface TabBarColorSet {
  /** Active tab icon + label color */
  active: string;
  /** Inactive tab icon + label color */
  inactive: string;
  /** Shadow color (platform shadow API) */
  shadow: string;
  /** Pill border color (subtle depth separator) */
  pillBorder: string;
  /** Pill background (translucent — expo-blur incompatibility; ADR 006 §决策四) */
  pillBackground: string;
}

/**
 * Navigation color palette keyed by color mode.
 * Values correspond to Foundation tokens defined in global.css.
 */
export const NAVIGATION_COLORS: Record<"light" | "dark", NavigationColorSet> = {
  light: {
    background: "#f8f8f9", // --color-neutral-50  (Foundation: --background)
    card: "#ffffff", // --color-white       (Foundation: --surface)
    text: "#18181b", // --color-eclipse     (Foundation: --foreground)
    border: "#d0d0d4", // --color-neutral-300 (Foundation: --border)
  },
  dark: {
    background: "#0d0d0e", // --color-neutral-950 (Foundation: --background)
    card: "#1f1f20", // --color-neutral-900 (Foundation: --surface)
    text: "#fcfcfc", // --color-snow        (Foundation: --foreground)
    border: "#58585a", // --color-neutral-700 (Foundation: --border)
  },
};

/**
 * Swipe action color set (used by SwipeableActionsRow).
 * StyleSheet-only context (Pressable bg + Text color in reanimated swipeable
 * action panel), so raw colors are required — same rationale as TAB_BAR_COLORS.
 *
 * Stage 1 simplification: single set (not light/dark keyed). The destructive
 * red stays consistent across themes (iOS HIG convention); the neutral grey
 * uses a mid-tone that reads OK in both modes. Stage 3 can split if a real
 * contrast issue emerges.
 */
export interface SwipeActionColorSet {
  /** Default (non-destructive) action background */
  neutralBg: string;
  /** Destructive action background (e.g. Delete) */
  destructiveBg: string;
  /** Action label color (white reads on both neutral + destructive) */
  label: string;
}

export const SWIPE_ACTION_COLORS: SwipeActionColorSet = {
  neutralBg: "#71717a", // --color-neutral-500 (mid grey readable both modes)
  destructiveBg: "#e11d48", // --color-red-600 (HIG destructive convention)
  label: "#ffffff", // --color-white (paired with both bgs)
};

/**
 * Floating tab bar color palette keyed by color mode.
 * Consumed by FloatingTabBar component via StyleSheet (raw values required).
 */
export const TAB_BAR_COLORS: Record<"light" | "dark", TabBarColorSet> = {
  light: {
    active: "#009717", // brand-600 — accent-derived for high contrast on light bg
    inactive: "#98989b", // neutral-500 (Foundation: --muted equivalent)
    shadow: "#000000", // standard iOS shadow color
    pillBorder: "rgba(0, 0, 0, 0.06)", // very subtle dark edge
    pillBackground: "rgba(255, 255, 255, 0.88)", // translucent white capsule (expo-blur stand-in)
  },
  dark: {
    active: "#50ff6c", // brand-300 / accent
    inactive: "#b7b7ba", // neutral-400
    shadow: "#000000", // standard shadow color
    pillBorder: "rgba(255, 255, 255, 0.08)", // subtle light edge for depth
    pillBackground: "rgba(30, 30, 30, 0.85)", // translucent dark capsule (expo-blur stand-in)
  },
};
