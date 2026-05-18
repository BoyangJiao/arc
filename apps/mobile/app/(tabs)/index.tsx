/**
 * (tabs)/index.tsx — Portfolio Tab (Home)
 *
 * Per IA v2.2 §四:
 * - Top area: total asset value (large font) in reporting currency
 * - Portfolio card list: each card shows name + holdings count + market value
 * - Tap card → router.push(`/portfolio/${id}`)
 * - Empty state guidance if no portfolio / no holdings
 * - Top bar: left avatar (Me entry), no title text, right empty (AI in Stage 3+)
 *
 * Fix 4 (audit): total value now uses usePortfolioValuation (price + FX +
 * computeMarketValue chain), not raw cost basis. S1-AC-2/3 verifiable.
 */

import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import {
  Card,
  DailySnapshotCard,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  Screen,
  Text,
  UserAvatar,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { parseAssetId } from "@arc/core";

import { useAuth } from "../../src/lib/auth";
import { currencySymbol, formatMoney } from "../../src/lib/format-money";
import {
  useDailyDelta,
  usePortfolios,
  usePortfolioHoldings,
  usePortfolioValuation,
} from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";

const ZERO = new Decimal(0);

/** Render Decimal with explicit sign + 2 decimals, like "+352.20" / "-12.30" / "0.00". */
const formatSignedDecimal = (value: Decimal): string => {
  if (value.isZero()) return value.toFixed(2);
  const sign = value.isPositive() ? "+" : "-";
  return `${sign}${value.abs().toFixed(2)}`;
};

export default function PortfolioTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();

  const { prefs } = useUserPreferences();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";

  // Fetch portfolios
  const { data: portfolios, isPending: portfoliosLoading } = usePortfolios();

  // Stage 1: single portfolio
  const defaultPortfolio = portfolios?.[0];
  const { holdings, isPending: holdingsPending } = usePortfolioHoldings(defaultPortfolio?.id);
  const {
    data: valuation,
    isFetching: valuationFetching,
    isError: valuationError,
    refreshFromLive,
  } = usePortfolioValuation(defaultPortfolio?.id, reportingCurrency);

  // Stage 2 J7 — Daily Snapshot (composes valuation + yesterday's snapshot)
  const dailyDelta = useDailyDelta(defaultPortfolio?.id, reportingCurrency);

  // Count from transactions (authoritative), not priced rows (AV rate-limit may drop quotes).
  const holdingsCount = holdings.length;
  const pricedCount = valuation?.perAsset.length ?? 0;
  const hasPartialQuotes =
    holdingsCount > 0 && pricedCount > 0 && pricedCount < holdingsCount && !valuationFetching;
  const hasHoldings = holdingsCount > 0;
  const totalValueText = formatMoney(valuation?.totalValue ?? ZERO, reportingCurrency);

  const handleAvatarPress = () => {
    router.push("/me" as Href);
  };

  const handlePortfolioPress = (id: string) => {
    router.push(`/portfolio/${id}` as Href);
  };

  return (
    <Screen
      contentContainerStyle={{
        padding: 24,
        gap: 16,
        paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET,
      }}
      refreshing={valuationFetching && !!valuation}
      onRefresh={() => refreshFromLive()}
    >
      {/* Top bar: avatar left (ADR 004 dicebear), no title */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={handleAvatarPress} accessibilityLabel={t("me.title")} hitSlop={8}>
          <UserAvatar seed={user?.email} size={40} />
        </Pressable>
        {/* Right side: empty in Stage 1-2 (AI icon in Stage 3+) */}
        <View className="w-10 h-10" />
      </View>

      {/* Stage 2 J7 — Daily Snapshot card (top of page, primary signal) */}
      {dailyDelta.data && (
        <DailySnapshotCard
          delta={dailyDelta.data}
          title={t("dailySnapshot.title")}
          noBaselineMessage={t("dailySnapshot.noBaseline")}
          disclaimer={t("common.disclaimer")}
          formatAmount={(amount) =>
            `${currencySymbol(reportingCurrency)}${formatSignedDecimal(amount)}`
          }
          formatPercent={(percent) => `${formatSignedDecimal(percent)}%`}
          formatAssetLabel={(assetId) => parseAssetId(assetId).symbol}
          onMoverPress={(assetId) => {
            // Stage 3 will route to asset detail; Stage 2 reserves the tap target.
            if (__DEV__) {
              console.info(`[daily-snapshot] tap ${assetId} — asset detail lands in Stage 3`);
            }
          }}
        />
      )}

      {/* Total asset value — secondary signal (Daily Snapshot is the hero now) */}
      <View className="mb-6">
        <Text className="text-muted text-sm mb-1">{t("portfolio.totalValue")}</Text>
        <Text className="text-foreground text-4xl font-bold">{totalValueText}</Text>
        {hasHoldings && <Text className="text-muted text-xs mt-1">{t("common.disclaimer")}</Text>}
        {hasPartialQuotes && (
          <Text className="text-muted text-xs mt-1">
            {t("portfolio.partialQuotes", { loaded: pricedCount, total: holdingsCount })}{" "}
            {t("portfolio.partialQuotesMissing", { missing: holdingsCount - pricedCount })}
          </Text>
        )}
        {valuationError && <Text className="text-danger text-xs mt-1">{t("common.error")}</Text>}
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
                      {t("portfolio.holdingsCount", { count: holdingsCount })}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-semibold">
                      {valuationFetching && !valuation ? t("common.loading") : totalValueText}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      )}

      {/* Empty holdings state within default portfolio */}
      {defaultPortfolio && !hasHoldings && !holdingsPending && !valuationFetching && (
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
