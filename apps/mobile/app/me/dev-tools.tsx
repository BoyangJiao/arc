/**
 * me/dev-tools.tsx — Full-screen Dev Tools (optional; FAB overlay is primary entry).
 */

import { View } from "react-native";
import { Stack } from "expo-router";
import { Screen, Text, useStackScreenOptions } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { DevToolsScenarioPanel } from "../../src/components/dev-tools/DevToolsScenarioPanel";

export default function DevToolsScreen() {
  const { t } = useTranslation();

  const screenOptions = useStackScreenOptions({
    title: t("devTools.title"),
    backType: "chevron",
  });

  if (!__DEV__) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        <View className="gap-4">
          <Text className="text-muted text-xs">{t("devTools.fabHint")}</Text>
          <DevToolsScenarioPanel />
        </View>
      </Screen>
    </>
  );
}
