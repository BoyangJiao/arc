/**
 * (tabs)/index.tsx — Portfolio Tab (Home)
 */

import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import {
  Card,
  DailySnapshotCard,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  Screen,
  TabScreenHeader,
  TabScrollShadow,
  Text,
  UserAvatar,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { parseAssetId, resolvePortfolioDisplayName } from "@arc/core";

import {
  PortfolioTabHeaderCenter,
  PortfolioTabHeaderManageButton,
} from "../../src/components/PortfolioTabHeader";
import { useAuth } from "../../src/lib/auth";
import { currencySymbol, formatMoney } from "../../src/lib/format-money";
import {
  useActivePortfolio,
  useDailyDelta,
  usePortfolioHoldings,
  usePortfolioValuation,
} from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";

const ZERO = new Decimal(0);

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

  const { portfolio: activePortfolio, isLoading: activeLoading } = useActivePortfolio();

  const activeId = activePortfolio?.id;
  const reportingCurrency = activePortfolio?.reportingCurrency ?? prefs?.reportingCurrency ?? "CNY";
  const { holdings, isPending: holdingsPending } = usePortfolioHoldings(activeId);
  const {
    data: valuation,
    isFetching: valuationFetching,
    isError: valuationError,
    refreshFromLive,
  } = usePortfolioValuation(activeId, reportingCurrency);

  const dailyDelta = useDailyDelta(activeId, reportingCurrency);

  const holdingsCount = holdings.length;
  const pricedCount = valuation?.perAsset.length ?? 0;
  const hasPartialQuotes =
    holdingsCount > 0 && pricedCount > 0 && pricedCount < holdingsCount && !valuationFetching;
  const hasHoldings = holdingsCount > 0;
  const totalValueText = formatMoney(
    hasHoldings && valuation ? valuation.totalValue : ZERO,
    reportingCurrency
  );

  const handleAvatarPress = () => {
    router.push("/me" as Href);
  };

  const handlePortfolioPress = (id: string) => {
    router.push(`/portfolio/${id}` as Href);
  };

  return (
    <Screen scroll={false} contentContainerStyle={{ flexGrow: 1 }}>
      <TabScreenHeader
        title={t("tabs.portfolio")}
        centerSlot={<PortfolioTabHeaderCenter />}
        leftSlot={
          <Pressable onPress={handleAvatarPress} accessibilityLabel={t("me.title")} hitSlop={8}>
            <UserAvatar seed={user?.email} size={40} />
          </Pressable>
        }
        rightSlot={<PortfolioTabHeaderManageButton />}
      />

      <TabScrollShadow>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET,
            flexGrow: 1,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={valuationFetching && !!valuation}
              onRefresh={() => refreshFromLive()}
            />
          }
        >
          <View className="mb-6">
            <Text className="text-muted text-sm mb-1">{t("portfolio.totalValue")}</Text>
            <Text className="text-foreground text-4xl font-bold">{totalValueText}</Text>
            {hasHoldings && (
              <Text className="text-muted text-xs mt-1">{t("common.disclaimer")}</Text>
            )}
            {hasPartialQuotes && (
              <Text className="text-muted text-xs mt-1">
                {t("portfolio.partialQuotes", { loaded: pricedCount, total: holdingsCount })}{" "}
                {t("portfolio.partialQuotesMissing", { missing: holdingsCount - pricedCount })}
              </Text>
            )}
            {valuationError && (
              <Text className="text-danger text-xs mt-1">{t("common.error")}</Text>
            )}
          </View>

          {dailyDelta.data ? (
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
                if (__DEV__) {
                  console.info(`[daily-snapshot] tap ${assetId} — asset detail lands in Stage 3`);
                }
              }}
            />
          ) : null}

          {activeLoading ? (
            <Text className="text-muted">{t("common.loading")}</Text>
          ) : !activePortfolio ? (
            <Card>
              <View className="p-6 items-center">
                <Text className="text-muted text-center mb-2">{t("portfolio.noPortfolios")}</Text>
                <Text className="text-muted text-xs text-center">
                  {t("portfolio.noPortfoliosHint")}
                </Text>
              </View>
            </Card>
          ) : (
            <Pressable onPress={() => handlePortfolioPress(activePortfolio.id)}>
              <Card>
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-foreground font-semibold text-lg">
                        {resolvePortfolioDisplayName(
                          activePortfolio.name,
                          t("portfolio.myPortfolio")
                        )}
                      </Text>
                      <Text className="text-muted text-sm">
                        {activePortfolio.reportingCurrency}
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
          )}

          {activePortfolio && !hasHoldings && !holdingsPending && !valuationFetching && (
            <View className="mt-4">
              <Card>
                <Pressable
                  onPress={() =>
                    router.push(`/portfolio/${activePortfolio.id}/transactions/new` as Href)
                  }
                >
                  <View className="p-6 items-center">
                    <Text className="text-muted text-center mb-2">{t("portfolio.empty")}</Text>
                    <Text className="text-foreground font-semibold">
                      {t("portfolio.emptyAction")}
                    </Text>
                  </View>
                </Pressable>
              </Card>
            </View>
          )}

          <View className="mt-4">
            <Text className="text-muted text-xs text-center">
              {t("common.notInvestmentAdvice")}
            </Text>
          </View>
        </ScrollView>
      </TabScrollShadow>
    </Screen>
  );
}
