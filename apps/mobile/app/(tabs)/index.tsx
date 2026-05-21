/**
 * (tabs)/index.tsx — Portfolio Tab (Home)
 */

import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import { parseAssetId, type Market } from "@arc/core";
import {
  Card,
  decimateChartPoints,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  formatCompactChangeLine,
  HoldingsTable,
  PortfolioHeroSection,
  Screen,
  TabScreenHeader,
  TabScrollShadow,
  Text,
  UserAvatar,
  DEFAULT_TIME_RANGE,
  type TimeRange,
} from "@arc/ui";
import {
  PortfolioTabHeaderCenter,
  PortfolioTabHeaderManageButton,
} from "../../src/components/PortfolioTabHeader";
import { useAuth } from "../../src/lib/auth";
import { currencySymbol, formatMoney } from "../../src/lib/format-money";
import {
  buildHoldingsTableRows,
  formatMarketSectionHeader,
} from "../../src/lib/holdings-presenter";
import {
  useActivePortfolio,
  useAssetCatalog,
  useDailyDelta,
  usePortfolioHoldings,
  usePortfolioValuation,
  usePortfolioValueSnapshots,
  snapshotsToChartPoints,
} from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";
import { useTranslation } from "@arc/i18n";

const ZERO = new Decimal(0);

const formatSignedDecimal = (value: Decimal): string => {
  if (value.isZero()) return value.toFixed(2);
  const sign = value.isPositive() ? "+" : "-";
  return `${sign}${value.abs().toFixed(2)}`;
};

export default function PortfolioTab() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [chartRange, setChartRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);

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
  const snapshots = usePortfolioValueSnapshots(activeId, chartRange);

  const assetIds = useMemo(() => holdings.map((h) => h.assetId), [holdings]);
  const catalog = useAssetCatalog(assetIds);

  const formatPercent = (d: Decimal) => `${d.isPositive() ? "+" : ""}${d.toFixed(2)}%`;

  const holdingsRows = useMemo(
    () =>
      buildHoldingsTableRows({
        holdings,
        perAsset: valuation?.perAsset ?? [],
        catalog: catalog.data,
        reportingCurrency,
        formatPercent,
        sharesLabel: (shares, symbol) =>
          t("portfolio.sharesRow", { shares: shares.toFixed(2), symbol }),
      }),
    [holdings, valuation?.perAsset, catalog.data, reportingCurrency, t]
  );

  const chartPoints = useMemo(
    () => decimateChartPoints(snapshotsToChartPoints(snapshots.data ?? [])),
    [snapshots.data]
  );

  const formatAnchorTime = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(i18n.language.startsWith("zh") ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(iso)),
    [i18n.language]
  );

  const marketLabel = (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US");

  const holdingsCount = holdings.length;
  const pricedCount = valuation?.perAsset.length ?? 0;
  const hasPartialQuotes =
    holdingsCount > 0 && pricedCount > 0 && pricedCount < holdingsCount && !valuationFetching;
  const hasHoldings = holdingsCount > 0;

  const handleAvatarPress = () => {
    router.push("/me" as Href);
  };

  const handleRowPress = (assetId: string) => {
    const { market, symbol } = parseAssetId(assetId);
    if (market === "CASH") return;
    router.push(`/asset/${market}/${symbol}` as Href);
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
          {activePortfolio ? (
            <PortfolioHeroSection
              totalValueTitle={t("portfolio.totalValue")}
              liveTotalValue={hasHoldings && valuation ? valuation.totalValue : ZERO}
              formatMoney={(amount) => formatMoney(amount, reportingCurrency)}
              delta={dailyDelta.data ?? null}
              noBaselineMessage={t("dailySnapshot.noBaseline")}
              formatChangeLine={(delta, percent) =>
                formatCompactChangeLine(delta, percent, currencySymbol(reportingCurrency))
              }
              formatPercent={(percent) => `${formatSignedDecimal(percent)}%`}
              formatAssetLabel={(assetId) => parseAssetId(assetId).symbol}
              formatAnchorTime={formatAnchorTime}
              onMoverPress={(assetId) => {
                const { market, symbol } = parseAssetId(assetId);
                if (market === "CASH") return;
                router.push(`/asset/${market}/${symbol}` as Href);
              }}
              chartData={chartPoints}
              chartRange={chartRange}
              onChartRangeChange={setChartRange}
              chartLoading={snapshots.isFetching}
              valuePrefix={currencySymbol(reportingCurrency)}
              emptyChartMessage={t("portfolio.noSnapshotHistory")}
            />
          ) : null}

          {hasPartialQuotes && (
            <Text className="text-muted text-xs -mt-2">
              {t("portfolio.partialQuotes", { loaded: pricedCount, total: holdingsCount })}{" "}
              {t("portfolio.partialQuotesMissing", { missing: holdingsCount - pricedCount })}
            </Text>
          )}
          {valuationError && <Text className="text-danger text-xs -mt-2">{t("common.error")}</Text>}

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
          ) : null}

          {hasHoldings && !holdingsPending ? (
            <HoldingsTable
              rows={holdingsRows}
              getSectionHeader={(market) =>
                formatMarketSectionHeader(
                  marketLabel(market),
                  holdingsRows.filter((r) => r.market === market),
                  valuation?.perAsset ?? [],
                  reportingCurrency
                )
              }
              collapseLabel={t("holdings.collapse")}
              expandLabel={t("holdings.expand")}
              onRowPress={handleRowPress}
            />
          ) : null}

          {activePortfolio && !hasHoldings && !holdingsPending && !valuationFetching && (
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
          )}

          <Text className="text-muted text-xs text-center">{t("common.notInvestmentAdvice")}</Text>
        </ScrollView>
      </TabScrollShadow>
    </Screen>
  );
}
