/**
 * me/inbox.tsx — Inbox (消息) empty state.
 *
 * Stage 3 Block E P1. Per stage-3-roadmap §七 tactical decision 4: ship the
 * empty state first; price-alert / reminder records (P2) will populate this
 * list once the detection job lands. No table, no data source yet.
 */

import { View } from "react-native";
import { InScreenHeader, Screen, Text, scrollContentBelowInScreenHeader } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

export default function InboxScreen() {
  const { t } = useTranslation();

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("inbox.title")} leftType="back" />
      <View className="flex-1 items-center justify-center gap-2 px-8 py-16">
        <Text className="text-foreground text-lg font-medium">{t("inbox.emptyTitle")}</Text>
        <Text className="text-muted text-center text-sm">{t("inbox.emptyDescription")}</Text>
      </View>
    </Screen>
  );
}
