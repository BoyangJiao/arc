/**
 * portfolio/[id]/daily-snapshot.tsx — Daily P&L detail (placeholder).
 */

import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { InScreenHeader, Screen, Text, TYPO_LABEL } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

export default function DailySnapshotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  return (
    <Screen>
      <InScreenHeader title={t("dailySnapshot.detailTitle")} />
      <View className="p-4">
        <Text className={TYPO_LABEL}>{t("dailySnapshot.detailPlaceholder")}</Text>
        {id ? <Text className={TYPO_LABEL}>{id}</Text> : null}
      </View>
    </Screen>
  );
}
