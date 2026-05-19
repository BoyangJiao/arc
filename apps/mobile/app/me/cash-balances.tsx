/**
 * /me/cash-balances — set cash balances via BUY/SELL on CASH:* (Stage 2).
 */

import { useState } from "react";
import { Alert, View } from "react-native";
import Decimal from "decimal.js";
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

import { currencySymbol } from "../../src/lib/format-money";
import { usePortfolios } from "../../src/lib/queries";
import {
  useCashBalances,
  useSaveCashBalances,
  type CashAssetId,
} from "../../src/lib/queries/use-cash-balances";

const tryAmount = (raw: string): Decimal | null => {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  try {
    const d = new Decimal(trimmed);
    return d.isNaN() || d.isNegative() ? null : d;
  } catch {
    return null;
  }
};

export default function CashBalancesScreen() {
  const { t } = useTranslation();
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { rows } = useCashBalances(portfolioId);
  const save = useSaveCashBalances();

  const [inputs, setInputs] = useState<Record<string, string>>({});

  const getInput = (assetId: CashAssetId, balance: Decimal) =>
    inputs[assetId] ?? balance.toString();

  const handleSave = async () => {
    if (!portfolioId) return;

    const desired = rows.map((row) => {
      const parsed = tryAmount(getInput(row.assetId, row.balance));
      if (!parsed) {
        throw new Error(t("rebalance.cashInvalidAmount"));
      }
      return { assetId: row.assetId, amount: parsed };
    });

    try {
      await save.mutateAsync({ portfolioId, desired });
      Alert.alert(t("rebalance.cashSavedTitle"), t("rebalance.cashSavedBody"));
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("rebalance.cashBalancesTitle")} leftType="back" />
      <Text className="text-muted text-sm mb-4">{t("rebalance.cashBalancesIntro")}</Text>
      <Text className="text-muted text-xs mb-6">{t("rebalance.cashBalancesStageNote")}</Text>

      <View className="gap-4">
        {rows.map((row) => (
          <View key={row.assetId} className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-foreground font-medium">
                {t(`rebalance.cashNames.${row.currency}` as "rebalance.cashNames.USD")}
              </Text>
              <Text className="text-muted text-xs">
                {t("rebalance.cashCurrent", {
                  amount: `${currencySymbol(row.currency)}${row.balance.toFixed(2)}`,
                })}
              </Text>
            </View>
            <TextField className="w-32">
              <Input
                value={getInput(row.assetId, row.balance)}
                onChangeText={(v) => setInputs((prev) => ({ ...prev, [row.assetId]: v }))}
                keyboardType="decimal-pad"
                className="text-right"
              />
            </TextField>
          </View>
        ))}
      </View>

      <Button className="mt-8" isDisabled={save.isPending} onPress={() => void handleSave()}>
        {t("common.save")}
      </Button>
    </Screen>
  );
}
