/**
 * (tabs)/insights.tsx — Insights Tab (Stage 1 = empty state)
 *
 * Per IA v2.2 §四: "Stage 1 = 空态 + Coming soon"
 * Central illustration + text, no action buttons.
 */

import { View } from "react-native";
import { Screen, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { FLOATING_TAB_BAR_BOTTOM_INSET } from "../../src/components/FloatingTabBar";

export default function InsightsTab() {
  const { t } = useTranslation();

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-6xl mb-6">💡</Text>
        <Text className="text-foreground text-xl font-semibold text-center mb-2">
          {t("insights.title")}
        </Text>
        <Text className="text-muted text-center mb-2">{t("insights.comingSoon")}</Text>
        <Text className="text-muted text-xs text-center">{t("insights.comingSoonHint")}</Text>
      </View>
    </Screen>
  );
}
