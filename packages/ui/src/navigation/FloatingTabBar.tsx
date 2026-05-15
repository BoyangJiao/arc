/**
 * FloatingTabBar — iOS 26-style floating capsule tab bar
 *
 * ADR 006 §决策四: 自建优于 react-native-bottom-tabs（跨端一致 > 单端原生）。
 * 归位于 @arc/ui/navigation/（T2 自建导航容器层）。
 *
 * Design characteristics:
 * - Floating capsule shape: centered, not full-width, rounded pill
 * - Frosted glass background via translucent rgba (expo-blur 暂不兼容 SDK 54)
 * - Compact size: ~52px height, ~65% screen width, horizontally centered
 * - Bottom offset: ~8px above safe area bottom
 * - Active tab: accent color icon + label
 * - Inactive tab: muted color icon + label
 * - Subtle shadow (light) / border (dark) for depth
 *
 * 颜色全部走 TAB_BAR_COLORS token（含 pillBackground）— 业务消费方零硬编码颜色。
 */

import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, TrendingUp, Lightbulb, type LucideIcon } from "lucide-react-native";

import { Text } from "../primitives/Text";
import { TAB_BAR_COLORS } from "../tokens/navigation-colors";

/** Route-name → Lucide icon component map */
const TAB_ICONS: Record<string, LucideIcon> = {
  index: BarChart3, // 组合 (Portfolio)
  markets: TrendingUp, // 行情 (Markets)
  insights: Lightbulb, // 洞察 (Insights)
};

/**
 * Minimal types for the custom tab bar component.
 * Defined locally to avoid importing transitive @react-navigation/native
 * which is not directly accessible under pnpm strict mode.
 */
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

/** Total vertical space the floating tab bar occupies from the safe-area bottom edge upward. */
export const FLOATING_TAB_BAR_HEIGHT = 52;

/** Vertical gap between tab bar bottom and the safe area bottom edge. */
const TAB_BAR_BOTTOM_GAP = 8;

/**
 * Total bottom inset that tab page content should add to avoid being hidden
 * behind the floating tab bar. Use this as extra paddingBottom in each tab's
 * Screen contentContainerStyle.
 *
 * Formula: TAB_BAR_BOTTOM_GAP + FLOATING_TAB_BAR_HEIGHT
 * (safe area bottom is added dynamically via useSafeAreaInsets)
 */
export const FLOATING_TAB_BAR_BOTTOM_INSET = TAB_BAR_BOTTOM_GAP + FLOATING_TAB_BAR_HEIGHT;

export interface FloatingTabBarProps extends BottomTabBarProps {
  /** Current color mode — passed in so this primitive doesn't reach into app-specific ThemeProvider. */
  colorMode: "light" | "dark";
  /** Translation function for tab labels (i18n decoupling — app owns i18next). */
  t: (key: string) => string;
}

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  colorMode,
  t,
}: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const isDark = colorMode === "dark";

  const tabColors = TAB_BAR_COLORS[colorMode];
  const activeColor = tabColors.active;
  const inactiveColor = tabColors.inactive;

  const containerStyle = useMemo(
    () => ({
      ...styles.container,
      paddingBottom: insets.bottom + TAB_BAR_BOTTOM_GAP,
    }),
    [insets.bottom]
  );

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

  return (
    <View style={containerStyle} pointerEvents="box-none">
      <View
        style={[
          styles.pill,
          isDark ? styles.pillDark : styles.pillLight,
          { backgroundColor: tabColors.pillBackground },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];

          const label =
            options.title !== undefined
              ? options.title
              : t(`tabs.${route.name === "index" ? "portfolio" : route.name}`);

          const IconComponent = TAB_ICONS[route.name];

          return (
            <Pressable
              key={route.key}
              onPress={() => handleTabPress(index)}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
            >
              <View style={styles.tabContent}>
                {IconComponent && (
                  <IconComponent
                    size={22}
                    color={isFocused ? activeColor : inactiveColor}
                    strokeWidth={isFocused ? 2.5 : 2}
                  />
                )}
                <Text
                  style={[
                    styles.label,
                    {
                      color: isFocused ? activeColor : inactiveColor,
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 26,
    overflow: "hidden",
    height: FLOATING_TAB_BAR_HEIGHT,
    width: "65%",
  },
  pillLight: {
    shadowColor: TAB_BAR_COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TAB_BAR_COLORS.light.pillBorder,
  },
  pillDark: {
    shadowColor: TAB_BAR_COLORS.dark.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TAB_BAR_COLORS.dark.pillBorder,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: FLOATING_TAB_BAR_HEIGHT,
  },
  tabItemPressed: {
    opacity: 0.7,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
  },
});
