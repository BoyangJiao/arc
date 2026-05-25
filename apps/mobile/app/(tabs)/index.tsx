/**
 * (tabs)/index.tsx — Portfolio Tab (Home)
 */

import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import { parseAssetId, type Market } from "@arc/core";
import {
  Button,
  Card,
  decimateChartPoints,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  formatCompactChangeLine,
  HOLDINGS_MARKET_ORDER,
  HoldingsMarketFilter,
  HoldingsTable,
  type HoldingPeriodChange,
  DailySnapshotCard,
  PortfolioHeroSection,
  Screen,
  TabScreenHeader,
  TabScrollShadow,
  Text,
  TwrInlineLabel,
  TYPO_CAPTION,
  TYPO_DANGER,
  TYPO_DISCLAIMER,
  TYPO_EMPTY_MESSAGE,
  TYPO_LABEL,
  TYPO_TITLE,
  typographyClass,
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
import { buildHoldingsTableRows } from "../../src/lib/holdings-presenter";
import {
  filterPortfolioDailySnapshot,
  filterPortfolioValuation,
  isMarketFilterActive,
} from "../../src/lib/portfolio-market-filter";
import {
  useActivePortfolio,
  useAssetCatalog,
  useDailyDelta,
  useDailySnapshot,
  usePortfolioHoldings,
  usePortfolioTwr,
  usePortfolioValuation,
  usePortfolioValueSnapshots,
  periodBaselineByAsset,
  snapshotsToChartPoints,
} from "../../src/lib/queries";
import { computeDailyDelta } from "@arc/core";
import { useUserPreferences } from "../../src/lib/user-preferences";
import { useTranslation } from "@arc/i18n";

const ZERO = new Decimal(0);

export default function PortfolioTab() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [chartRange, setChartRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const [selectedMarketFilters, setSelectedMarketFilters] = useState<Set<Market>>(() => new Set());

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
  const dailySnapshot = useDailySnapshot(activeId);
  const snapshots = usePortfolioValueSnapshots(activeId, chartRange);
  const portfolioTwr = usePortfolioTwr({ portfolioId: activeId, range: chartRange });

  const assetIds = useMemo(() => holdings.map((h) => h.assetId), [holdings]);
  const catalog = useAssetCatalog(assetIds);

  const marketLabel = useCallback(
    (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US"),
    [t]
  );

  const formatPositionLabel = useCallback(
    (shares: Decimal, market: Market, symbol: string) => {
      const qty = shares.toFixed(2);
      switch (market) {
        case "FUND":
          return t("holdings.positionUnits.fund", { shares: qty });
        case "CRYPTO":
          return t("holdings.positionUnits.crypto", { shares: qty, symbol });
        case "CASH":
          return t("holdings.positionUnits.cash", { shares: qty, symbol });
        default:
          return t("holdings.positionUnits.equity", { shares: qty });
      }
    },
    [t]
  );

  const formatHoldingsAccessibilityLabel = useCallback(
    (args: {
      symbol: string;
      name: string;
      valueLabel: string;
      periodChange: HoldingPeriodChange;
    }) => {
      const { symbol, name, valueLabel, periodChange } = args;
      if (periodChange.kind === "new-position") {
        return t("holdings.a11y.rowNewPosition", { symbol, name, value: valueLabel });
      }
      if (periodChange.kind === "ok") {
        const change = formatCompactChangeLine(
          periodChange.delta,
          periodChange.percent,
          currencySymbol(reportingCurrency)
        );
        return t("holdings.a11y.rowWithChange", { symbol, name, value: valueLabel, change });
      }
      return t("holdings.a11y.row", { symbol, name, value: valueLabel });
    },
    [t, reportingCurrency]
  );

  const holdingsPeriodBaseline = useMemo(
    () => periodBaselineByAsset(snapshots.data ?? []),
    [snapshots.data]
  );

  const holdingsRows = useMemo(
    () =>
      buildHoldingsTableRows({
        holdings,
        perAsset: valuation?.perAsset ?? [],
        catalog: catalog.data,
        reportingCurrency,
        quoteLoading: valuationFetching && !valuation,
        formatPeriodChangeLine: (delta, percent) =>
          formatCompactChangeLine(delta, percent, currencySymbol(reportingCurrency)),
        positionLabel: formatPositionLabel,
        marketLabel,
        newPositionLabel: t("holdings.periodChange.newPosition"),
        formatAccessibilityLabel: formatHoldingsAccessibilityLabel,
        periodBaselineByAsset: holdingsPeriodBaseline,
      }),
    [
      holdings,
      valuation?.perAsset,
      valuation,
      valuationFetching,
      catalog.data,
      reportingCurrency,
      holdingsPeriodBaseline,
      formatPositionLabel,
      formatHoldingsAccessibilityLabel,
      t,
    ]
  );

  const marketsInPortfolio = useMemo(() => {
    const present = new Set(holdingsRows.map((r) => r.market));
    return HOLDINGS_MARKET_ORDER.filter((m) => present.has(m));
  }, [holdingsRows]);

  const filteredHoldingsRows = useMemo(() => {
    if (selectedMarketFilters.size === 0) return holdingsRows;
    return holdingsRows.filter((row) => selectedMarketFilters.has(row.market));
  }, [holdingsRows, selectedMarketFilters]);

  const marketFilterActive = isMarketFilterActive(selectedMarketFilters);

  const holdingsCount = holdings.length;
  const hasHoldings = holdingsCount > 0;

  const heroTotalValue = useMemo(() => {
    if (!valuation || !hasHoldings) return ZERO;
    if (!marketFilterActive) return valuation.totalValue;
    return filterPortfolioValuation(valuation, selectedMarketFilters).totalValue;
  }, [valuation, hasHoldings, marketFilterActive, selectedMarketFilters]);

  const heroDelta = useMemo(() => {
    if (dailyDelta.isPending || dailyDelta.isError || !valuation) return null;
    if (!marketFilterActive) return dailyDelta.data;
    const filteredValuation = filterPortfolioValuation(valuation, selectedMarketFilters);
    const filteredBaseline = dailySnapshot.data
      ? filterPortfolioDailySnapshot(dailySnapshot.data, selectedMarketFilters)
      : null;
    return computeDailyDelta(filteredValuation, filteredBaseline);
  }, [
    dailyDelta.isPending,
    dailyDelta.isError,
    dailyDelta.data,
    valuation,
    marketFilterActive,
    selectedMarketFilters,
    dailySnapshot.data,
  ]);

  const chartPoints = useMemo(
    () =>
      decimateChartPoints(
        snapshotsToChartPoints(
          snapshots.data ?? [],
          marketFilterActive ? selectedMarketFilters : undefined
        )
      ),
    [snapshots.data, marketFilterActive, selectedMarketFilters]
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

  const formatSnapshotFooterDate = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(i18n.language.startsWith("zh") ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(iso)),
    [i18n.language]
  );

  const handleDailySnapshotPress = useCallback(() => {
    if (!activeId) return;
    router.push(`/portfolio/${activeId}/daily-snapshot` as Href);
  }, [activeId, router]);

  const pricedCount = valuation?.perAsset.length ?? 0;
  const hasPartialQuotes =
    holdingsCount > 0 && pricedCount > 0 && pricedCount < holdingsCount && !valuationFetching;

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
            <View className="gap-6">
              {hasHoldings && !holdingsPending ? (
                <HoldingsMarketFilter
                  markets={marketsInPortfolio}
                  labelFor={marketLabel}
                  selectedMarkets={selectedMarketFilters}
                  onSelectedMarketsChange={setSelectedMarketFilters}
                />
              ) : null}
              <PortfolioHeroSection
                totalValueTitle={t("portfolio.totalValue")}
                liveTotalValue={heroTotalValue}
                formatMoney={(amount) => formatMoney(amount, reportingCurrency)}
                delta={heroDelta}
                noBaselineMessage={t("dailySnapshot.noBaseline")}
                formatChangeLine={(delta, percent) =>
                  formatCompactChangeLine(delta, percent, currencySymbol(reportingCurrency))
                }
                formatAnchorTime={formatAnchorTime}
                chartData={chartPoints}
                chartRange={chartRange}
                onChartRangeChange={setChartRange}
                chartLoading={snapshots.isFetching}
                valuePrefix={currencySymbol(reportingCurrency)}
                emptyChartMessage={t("portfolio.noSnapshotHistory")}
                twrInline={
                  <TwrInlineLabel
                    range={chartRange}
                    result={portfolioTwr.isError ? undefined : portfolioTwr.data}
                    loading={portfolioTwr.isLoading}
                    unavailable={t("twr.unavailable")}
                    twrAbbrevLabel={t("twr.label")}
                    tooltipTitle={t("twr.tooltipTitle")}
                    tooltipBody={t("twr.tooltipBody")}
                    closeLabel={t("common.close")}
                  />
                }
              />
              {heroDelta && heroDelta.status !== "empty-portfolio" ? (
                <DailySnapshotCard
                  delta={heroDelta}
                  title={t("dailySnapshot.title")}
                  noBaselineMessage={t("dailySnapshot.noBaseline")}
                  formatChangeLine={(delta, percent) =>
                    formatCompactChangeLine(delta, percent, currencySymbol(reportingCurrency))
                  }
                  formatFooterDate={formatSnapshotFooterDate}
                  onPress={heroDelta.status === "ok" ? handleDailySnapshotPress : undefined}
                />
              ) : null}
            </View>
          ) : null}

          {hasPartialQuotes && (
            <Text className={typographyClass("caption", "-mt-2")}>
              {t("portfolio.partialQuotes", { loaded: pricedCount, total: holdingsCount })}{" "}
              {t("portfolio.partialQuotesMissing", { missing: holdingsCount - pricedCount })}
            </Text>
          )}
          {valuationError && (
            <Text className={typographyClass("danger", "-mt-2")}>{t("common.error")}</Text>
          )}

          {activeLoading ? (
            <Text className={TYPO_LABEL}>{t("common.loading")}</Text>
          ) : !activePortfolio ? (
            <Card>
              <View className="p-6 items-center">
                <Text className={typographyClass("emptyMessage", "mb-2")}>
                  {t("portfolio.noPortfolios")}
                </Text>
                <Text className={TYPO_CAPTION}>{t("portfolio.noPortfoliosHint")}</Text>
              </View>
            </Card>
          ) : null}

          {hasHoldings && !holdingsPending ? (
            <>
              <HoldingsTable
                rows={filteredHoldingsRows}
                sectionTitle={t("holdings.sectionTitle")}
                emptyMessage={
                  selectedMarketFilters.size > 0 ? t("holdings.filterEmpty") : undefined
                }
                onRowPress={handleRowPress}
              />
              <Button
                onPress={() => {
                  if (!activeId) return;
                  router.push(`/portfolio/${activeId}/transactions/new` as Href);
                }}
              >
                <Button.Label>{t("portfolio.addTransaction")}</Button.Label>
              </Button>
            </>
          ) : null}

          {activePortfolio && !hasHoldings && !holdingsPending && !valuationFetching && (
            <Card>
              <Pressable
                onPress={() =>
                  router.push(`/portfolio/${activePortfolio.id}/transactions/new` as Href)
                }
              >
                <View className="p-6 items-center">
                  <Text className={typographyClass("emptyMessage", "mb-2")}>
                    {t("portfolio.empty")}
                  </Text>
                  <Text className={TYPO_TITLE}>{t("portfolio.emptyAction")}</Text>
                </View>
              </Pressable>
            </Card>
          )}

          <Text className={typographyClass("disclaimer", "text-center")}>
            {t("common.notInvestmentAdvice")}
          </Text>
        </ScrollView>
      </TabScrollShadow>
    </Screen>
  );
}
