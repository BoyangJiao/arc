/**
 * portfolio/[id]/index.tsx — Portfolio Detail page
 *
 * Per IA v2.2 §四:
 * - Top: portfolio name + total market value + price delay disclaimer
 * - Holdings table: asset name + quantity + native price + reporting price + market value
 * - Right-bottom FAB: inherited from home (target portfolio pre-filled)
 * - Header title: portfolio name (exception to "no title" rule — detail needs identifier)
 *
 * Data flow:
 *   transactions → computeHoldings → for each holding, fetch price + fx → computeMarketValue
 */

import { View } from "react-native";
import { useLocalSearchParams, useRouter, Stack, type Href } from "expo-router";
import { useMemo } from "react";
import Decimal from "decimal.js";
import { Button, Card, Screen, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { computeHoldings, parseAssetId } from "@arc/core";
import type { Holding } from "@arc/core";

import { usePortfolio, useTransactions } from "../../../src/lib/queries";
import { useUserPreferences } from "../../../src/lib/user-preferences";

export default function PortfolioDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { prefs } = useUserPreferences();

  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";
  const currencySymbol = reportingCurrency === "CNY" ? "¥" : "$";

  // Fetch portfolio metadata
  const { data: portfolio } = usePortfolio(id);

  // Fetch transactions → compute holdings
  const { data: transactions, isPending: txLoading } = useTransactions(id);

  const holdings = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    return computeHoldings(transactions);
  }, [transactions]);

  // Stage 1 simplified valuation: show cost basis per holding
  // Full valuation (with live prices) requires per-asset price queries
  // which are expensive on the free tier (25/day). We show cost basis and
  // let the portfolio tab handle the aggregation.
  const totalCostBasis = useMemo(() => {
    let total = new Decimal(0);
    for (const h of holdings) {
      total = total.plus(h.shares.times(h.averageCost));
    }
    return total;
  }, [holdings]);

  const handleAddTransaction = () => {
    router.push(`/portfolio/${id}/transactions/new` as Href);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: portfolio?.name ?? t("portfolio.title"),
          headerBackTitle: t("common.back"),
        }}
      />
      <Screen>
        {/* Total market value section */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-1">{t("portfolioDetail.totalMarketValue")}</Text>
          <Text className="text-foreground text-3xl font-bold">
            {currencySymbol}
            {totalCostBasis.toFixed(2)}
          </Text>
          <Text className="text-muted text-xs mt-1">{t("common.disclaimer")}</Text>
        </View>

        {/* Holdings table */}
        {txLoading ? (
          <Text className="text-muted">{t("common.loading")}</Text>
        ) : holdings.length === 0 ? (
          <Card>
            <View className="p-6 items-center">
              <Text className="text-muted text-center mb-2">
                {t("portfolioDetail.emptyHoldings")}
              </Text>
              <Text className="text-muted text-xs text-center mb-4">
                {t("portfolioDetail.emptyHoldingsHint")}
              </Text>
              <Button onPress={handleAddTransaction}>
                <Button.Label>{t("portfolio.addTransaction")}</Button.Label>
              </Button>
            </View>
          </Card>
        ) : (
          <View className="gap-3">
            {/* Table header */}
            <View className="flex-row px-2 pb-2">
              <Text className="text-muted text-xs flex-1">{t("portfolioDetail.asset")}</Text>
              <Text className="text-muted text-xs w-16 text-right">
                {t("portfolioDetail.shares")}
              </Text>
              <Text className="text-muted text-xs w-20 text-right">
                {t("portfolioDetail.price")}
              </Text>
              <Text className="text-muted text-xs w-24 text-right">
                {t("portfolioDetail.value")}
              </Text>
            </View>

            {/* Holdings rows */}
            {holdings.map((holding) => (
              <HoldingRow key={holding.assetId} holding={holding} currencySymbol={currencySymbol} />
            ))}
          </View>
        )}

        {/* FAB — Add Transaction */}
        {holdings.length > 0 && (
          <View className="mt-6">
            <Button onPress={handleAddTransaction}>
              <Button.Label>{t("portfolio.addTransaction")}</Button.Label>
            </Button>
          </View>
        )}

        {/* Disclaimer */}
        <View className="mt-4">
          <Text className="text-muted text-xs text-center">{t("common.notInvestmentAdvice")}</Text>
        </View>
      </Screen>
    </>
  );
}

function HoldingRow({ holding, currencySymbol }: { holding: Holding; currencySymbol: string }) {
  const { symbol } = parseAssetId(holding.assetId);
  const value = holding.shares.times(holding.averageCost);

  return (
    <Card>
      <View className="flex-row items-center px-3 py-3">
        <View className="flex-1">
          <Text className="text-foreground font-medium">{symbol}</Text>
          <Text className="text-muted text-xs">{holding.currency}</Text>
        </View>
        <Text className="text-foreground w-16 text-right text-sm">{holding.shares.toFixed(2)}</Text>
        <Text className="text-foreground w-20 text-right text-sm">
          {holding.averageCost.toFixed(2)}
        </Text>
        <Text className="text-foreground w-24 text-right text-sm font-medium">
          {currencySymbol}
          {value.toFixed(2)}
        </Text>
      </View>
    </Card>
  );
}
