/**
 * /me/portfolios/new — create portfolio modal.
 */

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  Button,
  InScreenHeader,
  Input,
  Screen,
  Text,
  TextField,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import type { Currency } from "@arc/core";

import { useCreatePortfolio } from "../../../src/lib/queries";

const CURRENCIES: Currency[] = ["CNY", "USD", "HKD", "JPY"];

export default function NewPortfolioScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreatePortfolio();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("CNY");

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      await create.mutateAsync({ name: trimmed, reportingCurrency: currency });
      router.back();
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader title={t("portfolios.newTitle")} leftType="back" />

        <TextField className="mb-4">
          <Text className="text-muted text-xs mb-1">{t("portfolios.nameLabel")}</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t("portfolios.namePlaceholder")}
          />
        </TextField>

        <Text className="text-muted text-xs mb-2">{t("portfolios.currencyLabel")}</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {CURRENCIES.map((c) => (
            <Button
              key={c}
              variant={currency === c ? "secondary" : "ghost"}
              onPress={() => setCurrency(c)}
            >
              <Button.Label>{c}</Button.Label>
            </Button>
          ))}
        </View>

        <Button
          variant="primary"
          isDisabled={!name.trim() || create.isPending}
          onPress={() => void handleCreate()}
        >
          <Button.Label>{t("portfolios.create")}</Button.Label>
        </Button>
      </Screen>
    </>
  );
}
