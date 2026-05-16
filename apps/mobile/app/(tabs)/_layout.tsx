/**
 * (tabs)/_layout.tsx — Bottom Tab Navigator
 *
 * 3 tabs: Portfolio, Markets, Insights
 * Per IA v2.2 §三: stable 3-tab navigation as anchor points.
 * Icons rendered by FloatingTabBar via Lucide (lucide-react-native).
 *
 * Custom iOS 26-style floating capsule tab bar via FloatingTabBar component.
 */

import { useMemo } from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "@arc/i18n";
import { FloatingTabBar } from "@arc/ui";

import { useColorMode } from "../../src/lib/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colorMode } = useColorMode();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      // Hide the default tab bar — FloatingTabBar renders in its place
      tabBarStyle: { display: "none" as const },
      tabBarShowLabel: false,
    }),
    []
  );

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} colorMode={colorMode} t={t} />}
      screenOptions={screenOptions}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.portfolio"),
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: t("tabs.markets"),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t("tabs.insights"),
        }}
      />
    </Tabs>
  );
}
