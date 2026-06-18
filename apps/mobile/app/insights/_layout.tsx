import { useMemo } from "react";
import { Stack } from "expo-router";

import { NAVIGATION_COLORS } from "@arc/ui";

import { useColorMode } from "../../src/lib/theme";

/**
 * Insights stack — owns rebalance setup (modal) + actions (push) screens.
 *
 * ADR 008: insights stack must apply NAVIGATION_COLORS to screenOptions so
 * the React Navigation header + status-bar safe area render the correct
 * background in dark mode. Without this, modal screens render a white
 * safe-area strip (截图 4、5 bug).
 */
export default function InsightsLayout() {
  const { colorMode } = useColorMode();
  const colors = NAVIGATION_COLORS[colorMode];

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.text,
    }),
    [colors]
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="rebalance/setup"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen name="rebalance/actions" />
      <Stack.Screen name="pnl-analysis" />
      <Stack.Screen name="exposure/[dimension]" />
      <Stack.Screen name="trade-stats" />
      <Stack.Screen name="risk" />
      <Stack.Screen name="drawdown" />
      <Stack.Screen name="asset-value" />
      <Stack.Screen name="benchmark" />
    </Stack>
  );
}
