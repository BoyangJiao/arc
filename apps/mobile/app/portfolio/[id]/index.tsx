/**
 * portfolio/[id]/index.tsx — Portfolio Detail page
 *
 * Per IA v2.2 §四:
 * - Top: portfolio name + total market value + price delay disclaimer
 * - Holdings table: asset name + quantity + native price + reporting value
 * - Header title: portfolio name (exception to "no title" rule — detail needs identifier)
 *
 * Data flow (Fix 4 — audit):
 *   transactions → computeHoldings → usePrice + useFxRate per holding →
 *   computeMarketValue → MarketValuation rows + PortfolioValuation totals.
 * Pulls via usePortfolioValuation which encapsulates the full chain in a
 * single TanStack Query with proper invalidation.
 */

import { View } from "react-native";
import { useLocalSearchParams, useRouter, Stack, type Href } from "expo-router";
import { Button, Card, Screen, Text, useStackScreenOptions } from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { parseAssetId, type Currency, type MarketValuation } from "@arc/core";
import Decimal from "decimal.js";

import { formatMoney } from "../../../src/lib/format-money";
import { usePortfolio, usePortfolioValuation } from "../../../src/lib/queries";
import { useUserPreferences } from "../../../src/lib/user-preferences";

const ZERO = new Decimal(0);

export default function PortfolioDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { prefs } = useUserPreferences();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";

  // Fetch portfolio metadata
  const { data: portfolio } = usePortfolio(id);

  // Full valuation chain (transactions → holdings → prices → FX → totals)
  const {
    data: valuation,
    isPending: valuationPending,
    isError: valuationError,
    error: valuationErrorObj,
  } = usePortfolioValuation(id, reportingCurrency);

  const perAsset = valuation?.perAsset ?? [];
  const isEmpty = !valuationPending && perAsset.length === 0;

  const handleAddTransaction = () => {
    router.push(`/portfolio/${id}/transactions/new` as Href);
  };

  const screenOptions = useStackScreenOptions({
    title: portfolio?.name ?? t("portfolio.title"),
    backType: "chevron",
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        {/* Total market value section */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-1">{t("portfolioDetail.totalMarketValue")}</Text>
          <Text className="text-foreground text-3xl font-bold">
            {formatMoney(valuation?.totalValue ?? ZERO, reportingCurrency)}
          </Text>
          <Text className="text-muted text-xs mt-1">{t("common.disclaimer")}</Text>
          {valuationError && (
            <Text className="text-danger text-xs mt-1">
              {valuationErrorObj?.message ?? t("common.error")}
            </Text>
          )}
        </View>

        {/* Holdings table */}
        {valuationPending ? (
          <Text className="text-muted">{t("common.loading")}</Text>
        ) : isEmpty ? (
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
            {/* Table header — 4 columns: asset / shares / native price / reporting value */}
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
            {perAsset.map((row) => (
              <HoldingRow key={row.assetId} valuation={row} reportingCurrency={reportingCurrency} />
            ))}
          </View>
        )}

        {/* Add transaction CTA (inline button — Stage 1 no real FAB) */}
        {perAsset.length > 0 && (
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

interface HoldingRowProps {
  valuation: MarketValuation;
  reportingCurrency: Currency;
}

function HoldingRow({ valuation, reportingCurrency }: HoldingRowProps) {
  const { symbol } = parseAssetId(valuation.assetId);

  return (
    <Card>
      <View className="flex-row items-center px-3 py-3">
        <View className="flex-1">
          <Text className="text-foreground font-medium">{symbol}</Text>
          <Text className="text-muted text-xs">{valuation.nativeCurrency}</Text>
        </View>
        <Text className="text-foreground w-16 text-right text-sm">
          {valuation.shares.toFixed(2)}
        </Text>
        <Text className="text-foreground w-20 text-right text-sm">
          {valuation.priceNative.toFixed(2)}
        </Text>
        <Text className="text-foreground w-24 text-right text-sm font-medium">
          {formatMoney(valuation.valueReporting, reportingCurrency)}
        </Text>
      </View>
    </Card>
  );
}
