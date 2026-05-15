/**
 * portfolio/[id]/transactions/new.tsx — Add Transaction Modal
 *
 * Per IA v2.2 §四:
 * - Form: asset search (US stocks only, Alpha Vantage) / buy / date / quantity / price / fee
 * - All amounts use Decimal
 * - Submit: write to transactions table, go back to detail, invalidate queries
 *
 * Stage 1 simplifications:
 * - Only BUY type (SELL/DIVIDEND/SPLIT in Stage 3)
 * - Asset ID manually entered as "US:SYMBOL" (search in Stage 2)
 * - Date defaults to today
 */

import { useCallback, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Decimal from "decimal.js";
import { Button, Screen, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useCreateTransaction } from "../../../../src/lib/queries";

export default function AddTransactionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: portfolioId } = useLocalSearchParams<{ id: string }>();

  const createTransaction = useCreateTransaction();

  // Form state
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [fee, setFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!symbol.trim()) {
      newErrors.symbol = t("transaction.required");
    }
    if (!shares.trim() || isNaN(Number(shares)) || Number(shares) <= 0) {
      newErrors.shares = t("transaction.invalidNumber");
    }
    if (!pricePerShare.trim() || isNaN(Number(pricePerShare)) || Number(pricePerShare) <= 0) {
      newErrors.pricePerShare = t("transaction.invalidNumber");
    }
    if (fee.trim() && isNaN(Number(fee))) {
      newErrors.fee = t("transaction.invalidNumber");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !portfolioId) return;

    const assetId = symbol.includes(":") ? symbol.toUpperCase() : `US:${symbol.toUpperCase()}`;

    await createTransaction.mutateAsync({
      portfolioId,
      assetId,
      type: "BUY",
      shares: new Decimal(shares).toString(),
      pricePerShare: new Decimal(pricePerShare).toString(),
      currency: "USD", // Stage 1: US stocks only
      fee: new Decimal(fee || "0").toString(),
      tradeDate: new Date().toISOString(),
      notes: notes || undefined,
    });

    router.back();
  };

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t("transaction.addTitle"),
          headerLeft: () => (
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text className="text-accent text-base">{t("common.close")}</Text>
            </Pressable>
          ),
        }}
      />
      <Screen edges={["bottom"]}>
        <View className="gap-4">
          {/* Asset symbol */}
          <View>
            <Text className="text-foreground text-sm font-medium mb-1">
              {t("portfolioDetail.asset")}
            </Text>
            <TextInput
              className="border border-muted rounded-lg px-3 py-3 text-foreground"
              placeholder={t("transaction.assetSearch")}
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {errors.symbol && <Text className="text-danger text-xs mt-1">{errors.symbol}</Text>}
          </View>

          {/* Transaction type — Stage 1 locked to BUY */}
          <View>
            <Text className="text-foreground text-sm font-medium mb-1">
              {t("transaction.type")}
            </Text>
            <View className="flex-row gap-2">
              <View className="bg-accent px-4 py-2 rounded-lg">
                <Text className="text-accent-foreground font-medium">{t("transaction.buy")}</Text>
              </View>
            </View>
          </View>

          {/* Shares */}
          <View>
            <Text className="text-foreground text-sm font-medium mb-1">
              {t("transaction.shares")}
            </Text>
            <TextInput
              className="border border-muted rounded-lg px-3 py-3 text-foreground"
              placeholder="0"
              value={shares}
              onChangeText={setShares}
              keyboardType="decimal-pad"
            />
            {errors.shares && <Text className="text-danger text-xs mt-1">{errors.shares}</Text>}
          </View>

          {/* Price per share */}
          <View>
            <Text className="text-foreground text-sm font-medium mb-1">
              {t("transaction.pricePerShare")}
            </Text>
            <TextInput
              className="border border-muted rounded-lg px-3 py-3 text-foreground"
              placeholder="0.00"
              value={pricePerShare}
              onChangeText={setPricePerShare}
              keyboardType="decimal-pad"
            />
            {errors.pricePerShare && (
              <Text className="text-danger text-xs mt-1">{errors.pricePerShare}</Text>
            )}
          </View>

          {/* Fee */}
          <View>
            <Text className="text-foreground text-sm font-medium mb-1">{t("transaction.fee")}</Text>
            <TextInput
              className="border border-muted rounded-lg px-3 py-3 text-foreground"
              placeholder="0.00"
              value={fee}
              onChangeText={setFee}
              keyboardType="decimal-pad"
            />
            {errors.fee && <Text className="text-danger text-xs mt-1">{errors.fee}</Text>}
          </View>

          {/* Notes */}
          <View>
            <Text className="text-foreground text-sm font-medium mb-1">
              {t("transaction.notes")}
            </Text>
            <TextInput
              className="border border-muted rounded-lg px-3 py-3 text-foreground"
              placeholder={t("transaction.notesPlaceholder")}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Submit */}
          <View className="mt-4">
            <Button onPress={handleSubmit} isDisabled={createTransaction.isPending}>
              <Button.Label>
                {createTransaction.isPending
                  ? t("transaction.submitting")
                  : t("transaction.submit")}
              </Button.Label>
            </Button>
          </View>

          {/* Error display */}
          {createTransaction.isError && (
            <Text className="text-danger text-sm text-center">
              {createTransaction.error?.message ?? t("common.error")}
            </Text>
          )}
        </View>
      </Screen>
    </>
  );
}
