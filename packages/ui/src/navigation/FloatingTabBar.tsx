/**
 * FloatingTabBar — iOS-style floating capsule tab bar (Crypto Wallet template–aligned)
 *
 * ADR 006 §决策四: 自建导航容器，归位 @arc/ui/navigation/。
 *
 * Visual (HeroUI Native + Ionicons outline/filled via TabBarIcon):
 * - Surface pill, icon-only tabs (no text labels; a11y labels from i18n)
 * - Active tab: bg-accent capsule + filled icon (accent-foreground)
 * - Inactive: outline icon (muted)
 *
 * Layout offset matches HeroUI Crypto Wallet template (12px above safe area).
 */

import { useCallback } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn, PressableFeedback, Surface } from "../primitives";
import { TabBarIcon } from "../wrappers/tab-bar-icons";

/** Gap between safe-area bottom and the pill (template: TAB_BAR_SAFE_OFFSET_ADDON_PX). */
export const TAB_BAR_SAFE_OFFSET_ADDON_PX = 12;

/** Inner tab hit target height (template: h-11). */
const TAB_ITEM_HEIGHT = 44;

/** Horizontal slot per tab (template: w-14). */
const TAB_ITEM_WIDTH = 56;

/** Surface vertical padding (template: p-1.5). */
const PILL_PADDING_Y = 6;

/** Total pill height — used for content bottom inset math. */
export const FLOATING_TAB_BAR_HEIGHT = TAB_ITEM_HEIGHT + PILL_PADDING_Y * 2;

/**
 * Total bottom inset for tab page scroll content (excludes safe-area bottom;
 * the tab bar itself sits at insets.bottom + TAB_BAR_SAFE_OFFSET_ADDON_PX).
 */
export const FLOATING_TAB_BAR_BOTTOM_INSET = TAB_BAR_SAFE_OFFSET_ADDON_PX + FLOATING_TAB_BAR_HEIGHT;

interface TabBarOptions {
  title?: string;
}

interface TabBarDescriptor {
  options: TabBarOptions;
}

interface TabRoute {
  key: string;
  name: string;
}

interface TabNavigationState {
  index: number;
  routes: TabRoute[];
}

interface TabNavigation {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: any): any;
  navigate(name: string): void;
}

interface BottomTabBarProps {
  state: TabNavigationState;
  descriptors: Record<string, TabBarDescriptor>;
  navigation: TabNavigation;
  insets: { top: number; right: number; bottom: number; left: number };
}

export interface FloatingTabBarProps extends BottomTabBarProps {
  /**
   * @deprecated Theme is read from HeroUINativeProvider; kept for API stability
   * with apps/mobile tab layout until Stage 2 cleanup.
   */
  colorMode?: "light" | "dark";
  /** i18n — used for accessibilityLabel only (icons have no visible labels). */
  t: (key: string) => string;
}

export function FloatingTabBar({ state, descriptors, navigation, t }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();

  const handleTabPress = useCallback(
    (index: number) => {
      const route = state.routes[index];
      const isFocused = state.index === index;

      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    },
    [state, navigation]
  );

  const resolveAccessibilityLabel = (routeName: string, title?: string): string => {
    if (title !== undefined) {
      return title;
    }
    const tabKey = routeName === "index" ? "portfolio" : routeName;
    return t(`tabs.${tabKey}`);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + TAB_BAR_SAFE_OFFSET_ADDON_PX,
        alignItems: "center",
      }}
    >
      <Surface
        variant="default"
        className="flex-row items-center gap-1 rounded-full p-1.5 shadow-overlay"
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label = resolveAccessibilityLabel(route.name, options.title);

          return (
            <PressableFeedback
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={() => handleTabPress(index)}
              hitSlop={6}
              className={cn(
                "items-center justify-center rounded-full",
                isFocused ? "bg-accent shadow-sm" : "bg-transparent"
              )}
              style={{ width: TAB_ITEM_WIDTH, height: TAB_ITEM_HEIGHT }}
            >
              <PressableFeedback.Highlight />
              <TabBarIcon routeName={route.name} focused={isFocused} />
            </PressableFeedback>
          );
        })}
      </Surface>
    </View>
  );
}
