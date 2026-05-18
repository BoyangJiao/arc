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

import { Alert, View } from "react-native";
import { useLocalSearchParams, useRouter, Stack, type Href } from "expo-router";
import { Button, Card, Screen, SwipeableActionsRow, Text, useStackScreenOptions } from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { parseAssetId, type Currency, type Holding, type MarketValuation } from "@arc/core";
import Decimal from "decimal.js";

import { formatMoney } from "../../../src/lib/format-money";
import {
  useDeleteAssetTransactions,
  usePortfolio,
  usePortfolioHoldings,
  usePortfolioValuation,
} from "../../../src/lib/queries";
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

  const { holdings, isPending: holdingsPending } = usePortfolioHoldings(id);

  // Full valuation chain (transactions → holdings → prices → FX → totals)
  const {
    data: valuation,
    isPending: valuationPending,
    isFetching: valuationFetching,
    isError: valuationError,
    error: valuationErrorObj,
    refreshFromLive,
  } = usePortfolioValuation(id, reportingCurrency);

  const valuationByAsset = new Map(
    (valuation?.perAsset ?? []).map((row) => [row.assetId, row] as const)
  );
  const isEmpty = !holdingsPending && holdings.length === 0;
  const showHoldingsTable = holdings.length > 0;
  const holdingsCount = holdings.length;
  const pricedCount = valuation?.perAsset.length ?? 0;
  const hasPartialQuotes =
    holdingsCount > 0 && pricedCount > 0 && pricedCount < holdingsCount && !valuationFetching;

  const deleteAssetTransactions = useDeleteAssetTransactions();

  const handleAddTransaction = () => {
    router.push(`/portfolio/${id}/transactions/new` as Href);
  };

  const handleRemoveHolding = (assetId: string, symbol: string) => {
    if (!id) return;
    Alert.alert(
      t("portfolioDetail.removeHoldingTitle"),
      t("portfolioDetail.removeHoldingMessage", { symbol }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("portfolioDetail.removeHolding"),
          style: "destructive",
          onPress: () => {
            void deleteAssetTransactions.mutateAsync({ portfolioId: id, assetId }).catch(() => {
              Alert.alert(t("common.error"), t("portfolioDetail.removeHoldingFailed"));
            });
          },
        },
      ]
    );
  };

  const screenOptions = useStackScreenOptions({
    title: portfolio?.name ?? t("portfolio.title"),
    backType: "chevron",
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen refreshing={valuationFetching && !!valuation} onRefresh={() => refreshFromLive()}>
        {/* Total market value section */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-1">{t("portfolioDetail.totalMarketValue")}</Text>
          <Text className="text-foreground text-3xl font-bold">
            {formatMoney(valuation?.totalValue ?? ZERO, reportingCurrency)}
          </Text>
          <Text className="text-muted text-xs mt-1">{t("common.disclaimer")}</Text>
          {hasPartialQuotes && (
            <Text className="text-muted text-xs mt-1">
              {t("portfolioDetail.partialQuotes", { loaded: pricedCount, total: holdingsCount })}{" "}
              {t("portfolioDetail.partialQuotesMissing", {
                missing: holdingsCount - pricedCount,
              })}
            </Text>
          )}
          {valuationError && (
            <Text className="text-danger text-xs mt-1">
              {valuationErrorObj?.message ?? t("common.error")}
            </Text>
          )}
        </View>

        {/* Holdings table — list all holdings from transactions; merge priced rows when ready */}
        {holdingsPending ? (
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
        ) : showHoldingsTable ? (
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

            {holdings.map((holding) => {
              const row = valuationByAsset.get(holding.assetId);
              return (
                <HoldingRow
                  key={holding.assetId}
                  holding={holding}
                  valuation={row}
                  quoteLoading={!row && (valuationPending || valuationFetching)}
                  reportingCurrency={reportingCurrency}
                  onRemove={() =>
                    handleRemoveHolding(holding.assetId, parseAssetId(holding.assetId).symbol)
                  }
                  t={t}
                />
              );
            })}
          </View>
        ) : null}

        {/* Add transaction CTA (inline button — Stage 1 no real FAB) */}
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

interface HoldingRowProps {
  holding: Holding;
  valuation: MarketValuation | undefined;
  quoteLoading: boolean;
  reportingCurrency: Currency;
  onRemove: () => void;
  t: (key: string) => string;
}

function HoldingRow({
  holding,
  valuation,
  quoteLoading,
  reportingCurrency,
  onRemove,
  t,
}: HoldingRowProps) {
  const { symbol } = parseAssetId(holding.assetId);
  const priceLabel = valuation
    ? valuation.priceNative.toFixed(2)
    : quoteLoading
      ? t("portfolioDetail.quoteLoading")
      : t("portfolioDetail.priceUnavailable");
  const valueLabel = valuation
    ? formatMoney(valuation.valueReporting, reportingCurrency)
    : quoteLoading
      ? t("portfolioDetail.quoteLoading")
      : t("portfolioDetail.priceUnavailable");

  return (
    <SwipeableActionsRow
      actions={[
        {
          key: "delete",
          label: t("portfolioDetail.removeHolding"),
          destructive: true,
          accessibilityLabel: t("portfolioDetail.removeHolding"),
          onPress: onRemove,
        },
      ]}
    >
      <Card>
        <View className="flex-row items-center px-3 py-3">
          <View className="flex-1">
            <Text className="text-foreground font-medium">{symbol}</Text>
            <Text className="text-muted text-xs">{holding.currency}</Text>
          </View>
          <Text className="text-foreground w-16 text-right text-sm">
            {holding.shares.toFixed(2)}
          </Text>
          <Text className="text-muted w-20 text-right text-sm">{priceLabel}</Text>
          <Text className="text-foreground w-24 text-right text-sm font-medium">{valueLabel}</Text>
        </View>
      </Card>
    </SwipeableActionsRow>
  );
}
