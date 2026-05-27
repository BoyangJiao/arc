/**
 * Entry mode picker — full trade vs opening snapshot (ADR 016).
 */

import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Button, InScreenHeader, Screen, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

export default function TransactionEntryModeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    id: portfolioId,
    prefillMarket,
    prefillSymbol,
  } = useLocalSearchParams<{
    id: string;
    prefillMarket?: string;
    prefillSymbol?: string;
  }>();

  useEffect(() => {
    if (prefillMarket && prefillSymbol) {
      router.replace({
        pathname: "/portfolio/[id]/transactions/new/trade",
        params: { id: portfolioId, prefillMarket, prefillSymbol },
      } as Href);
    }
  }, [portfolioId, prefillMarket, prefillSymbol, router]);

  if (prefillMarket && prefillSymbol) {
    return null;
  }

  return (
    <Screen edges={["bottom"]}>
      <InScreenHeader title={t("transaction.entry.modePicker.title")} leftType="close" />
      <View className="gap-4">
        <Button
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/portfolio/[id]/transactions/new/trade",
              params: { id: portfolioId },
            } as Href)
          }
        >
          <Button.Label>{t("transaction.entry.modeA.label")}</Button.Label>
        </Button>
        <Text className="text-muted text-sm">{t("transaction.entry.modeA.hint")}</Text>

        <Button
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/portfolio/[id]/transactions/new/snapshot",
              params: { id: portfolioId },
            } as Href)
          }
        >
          <Button.Label>{t("transaction.entry.modeD.label")}</Button.Label>
        </Button>
        <Text className="text-muted text-sm">{t("transaction.entry.modeD.hint")}</Text>
      </View>
    </Screen>
  );
}
