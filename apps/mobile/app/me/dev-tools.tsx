/**
 * me/dev-tools.tsx — Full-screen Dev Tools (optional; FAB overlay is primary entry).
 */

import { View } from "react-native";
import { InScreenHeader, Screen, Text, scrollContentBelowInScreenHeader } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { DevToolsScenarioPanel } from "../../src/components/dev-tools/DevToolsScenarioPanel";

export default function DevToolsScreen() {
  const { t } = useTranslation();

  if (!__DEV__) {
    return null;
  }

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("devTools.title")} leftType="back" />
      <View className="gap-4">
        <Text className="text-muted text-xs">{t("devTools.fabHint")}</Text>
        <DevToolsScenarioPanel />
      </View>
    </Screen>
  );
}
