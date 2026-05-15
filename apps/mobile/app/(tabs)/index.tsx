/**
 * (tabs)/index.tsx — Portfolio Tab (Home)
 *
 * Per IA v2.2 §四:
 * - Top area: total asset value (large font) + total PnL (colored)
 * - Portfolio card list: each card shows name + holdings count + market value
 * - Tap card → router.push(`/portfolio/${id}`)
 * - Empty state guidance if no portfolio / no holdings
 * - Top bar: left avatar (Me entry), no title text, right empty (AI in Stage 3+)
 */

import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import Decimal from "decimal.js";
import { Card, Screen, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { computeHoldings } from "@arc/core";

import { useAuth } from "../../src/lib/auth";
import { FLOATING_TAB_BAR_BOTTOM_INSET } from "../../src/components/FloatingTabBar";
import { usePortfolios, useTransactions } from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";

export default function PortfolioTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();

  const { prefs } = useUserPreferences();

  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";
  const currencySymbol = reportingCurrency === "CNY" ? "¥" : "$";

  // Fetch portfolios
  const { data: portfolios, isPending: portfoliosLoading } = usePortfolios();

  // For Stage 1: single portfolio — get its transactions
  const defaultPortfolio = portfolios?.[0];
  const { data: transactions } = useTransactions(defaultPortfolio?.id);

  // Compute holdings from transactions
  const holdings = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    return computeHoldings(transactions);
  }, [transactions]);

  // For Stage 1 simplified: show total value as sum of holdings × avg cost
  // Real valuation requires live prices; we show cost basis as a placeholder when prices unavailable
  const totalCostBasis = useMemo(() => {
    let total = new Decimal(0);
    for (const h of holdings) {
      total = total.plus(h.shares.times(h.averageCost));
    }
    return total;
  }, [holdings]);

  const handleAvatarPress = () => {
    router.push("/me" as Href);
  };

  const handlePortfolioPress = (id: string) => {
    router.push(`/portfolio/${id}` as Href);
  };

  return (
    <Screen
      contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}
    >
      {/* Top bar: avatar left, no title */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={handleAvatarPress} accessibilityLabel={t("me.title")}>
          <View className="w-10 h-10 rounded-full bg-accent items-center justify-center">
            <Text className="text-accent-foreground text-sm font-semibold">
              {user?.email?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
        </Pressable>
        {/* Right side: empty in Stage 1-2 (AI icon in Stage 3+) */}
        <View className="w-10 h-10" />
      </View>

      {/* Total asset value — visual focus */}
      <View className="mb-6">
        <Text className="text-muted text-sm mb-1">{t("portfolio.totalValue")}</Text>
        <Text className="text-foreground text-4xl font-bold">
          {currencySymbol}
          {totalCostBasis.toFixed(2)}
        </Text>
        {holdings.length > 0 && (
          <Text className="text-muted text-xs mt-1">{t("common.disclaimer")}</Text>
        )}
      </View>

      {/* Portfolio cards */}
      {portfoliosLoading ? (
        <Text className="text-muted">{t("common.loading")}</Text>
      ) : !portfolios || portfolios.length === 0 ? (
        <Card>
          <View className="p-6 items-center">
            <Text className="text-muted text-center mb-2">{t("portfolio.noPortfolios")}</Text>
            <Text className="text-muted text-xs text-center">
              {t("portfolio.noPortfoliosHint")}
            </Text>
          </View>
        </Card>
      ) : (
        portfolios.map((portfolio) => (
          <Pressable key={portfolio.id} onPress={() => handlePortfolioPress(portfolio.id)}>
            <Card>
              <View className="p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-foreground font-semibold text-lg">{portfolio.name}</Text>
                    <Text className="text-muted text-sm">
                      {t("portfolio.holdingsCount", { count: holdings.length })}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-semibold">
                      {currencySymbol}
                      {totalCostBasis.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      )}

      {/* Empty holdings state within default portfolio */}
      {defaultPortfolio && holdings.length === 0 && (
        <View className="mt-4">
          <Card>
            <Pressable
              onPress={() =>
                router.push(`/portfolio/${defaultPortfolio.id}/transactions/new` as Href)
              }
            >
              <View className="p-6 items-center">
                <Text className="text-muted text-center mb-2">{t("portfolio.empty")}</Text>
                <Text className="text-accent font-semibold">{t("portfolio.emptyAction")}</Text>
              </View>
            </Pressable>
          </Card>
        </View>
      )}

      {/* Disclaimer */}
      <View className="mt-4">
        <Text className="text-muted text-xs text-center">{t("common.notInvestmentAdvice")}</Text>
      </View>
    </Screen>
  );
}
