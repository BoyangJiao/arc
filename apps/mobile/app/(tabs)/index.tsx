/**
 * (tabs)/index.tsx — Portfolio Tab (Home)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  HoldingsSortControl,
  HoldingsTable,
  type HoldingPeriodChange,
  type HoldingsSortKey,
  AmountVisibilityToggle,
  DailySnapshotCard,
  PortfolioHeroSection,
  Screen,
  TabScreenHeader,
  TabScrollShadow,
  Text,
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
import { CacheStatusBar } from "../../src/components/CacheStatusBar";
import { useAuth } from "../../src/lib/auth";
import { pickDefaultRangeForTransactions } from "../../src/lib/default-chart-range";
import { currencySymbol, formatMoney, formatShares } from "../../src/lib/format-money";
import { useAmountRedacted } from "../../src/lib/use-amount-redacted";
import { buildHoldingsTableRows, sortHoldingsRows } from "../../src/lib/holdings-presenter";
import {
  filterPortfolioValuation,
  isMarketFilterActive,
  serializeMarketFilters,
} from "../../src/lib/portfolio-market-filter";
import {
  useActivePortfolio,
  useAssetCatalog,
  useDailyDelta,
  useEnsureDefaultPortfolio,
  usePortfolioHoldings,
  usePortfolios,
  usePortfolioChartSeries,
  usePortfolioValuation,
  snapshotsToChartPoints,
} from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";
import { useTranslation } from "@arc/i18n";

const ZERO = new Decimal(0);

/**
 * Daily P&L card visibility on the Portfolio Tab.
 *
 * Hidden for now: equity markets don't trade on weekends, so checking on a
 * Monday (or any post-holiday) routinely shows a stale / "no overnight data"
 * baseline, which reads as broken. Daily P&L is also not core to Arc's job
 * (allocation tracking + rebalancing), so it doesn't earn the prime slot.
 *
 * The full feature is intact — hook (`useDailyDelta`), pure compute
 * (`@arc/core` `computeDailyDelta`), card, and the detail route
 * (`/portfolio/[id]/daily-snapshot`) all still work. Flip this to re-surface
 * it (e.g. gate behind a paid tier later).
 */
const SHOW_DAILY_SNAPSHOT_CARD = false;

export default function PortfolioTab() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [chartRange, setChartRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const userPickedRangeRef = useRef(false);
  const handleChartRangeChange = useCallback((range: TimeRange) => {
    userPickedRangeRef.current = true;
    setChartRange(range);
  }, []);
  const [selectedMarketFilters, setSelectedMarketFilters] = useState<Set<Market>>(() => new Set());
  const marketFilterActive = isMarketFilterActive(selectedMarketFilters);
  const [sortKey, setSortKey] = useState<HoldingsSortKey>("value_desc");

  const { prefs } = useUserPreferences();
  const { amountsHidden, toggleAmountVisibility } = useAmountRedacted();

  const { portfolio: activePortfolio, isLoading: activeLoading } = useActivePortfolio();

  // Invariant: a signed-in user always has the default portfolio ("主要投资组合",
  // inheriting the Settings reporting currency). Enforce it here — the deterministic
  // landing point — so reset / fresh-signup / skipped-welcome all self-heal instead
  // of dead-ending on the "no portfolio" empty state. ensureDefault is idempotent
  // (returns the existing portfolio if any); a ref guards against double-firing.
  const { data: allPortfolios, isPending: portfoliosPending } = usePortfolios();
  const ensureDefaultPortfolio = useEnsureDefaultPortfolio();
  const ensuredDefaultRef = useRef(false);
  useEffect(() => {
    if (ensuredDefaultRef.current) return;
    if (!user || portfoliosPending) return;
    if ((allPortfolios?.length ?? 0) > 0) return;
    ensuredDefaultRef.current = true;
    void ensureDefaultPortfolio.mutateAsync({
      reportingCurrency: prefs?.reportingCurrency ?? "CNY",
    });
  }, [
    user,
    portfoliosPending,
    allPortfolios?.length,
    prefs?.reportingCurrency,
    ensureDefaultPortfolio,
  ]);

  const activeId = activePortfolio?.id;
  // Global Settings currency is authoritative; per-portfolio reportingCurrency
  // only seeds new-portfolio defaults — it must not shadow the user's chosen
  // global reporting currency in display/valuation (each holding keeps its own
  // native currency; conversion always targets this global one).
  const reportingCurrency = prefs?.reportingCurrency ?? activePortfolio?.reportingCurrency ?? "CNY";
  const currencySym = currencySymbol(reportingCurrency);
  const formatChangeLine = useCallback(
    (delta: Decimal, percent: Decimal | null) =>
      formatCompactChangeLine(delta, percent, currencySym, { redactAmount: amountsHidden }),
    [currencySym, amountsHidden]
  );
  const formatAmount = useCallback(
    (amount: Decimal) => formatMoney(amount, reportingCurrency, { redact: amountsHidden }),
    [reportingCurrency, amountsHidden]
  );
  const { holdings, transactions, isPending: holdingsPending } = usePortfolioHoldings(activeId);

  // Smart default fires ONCE per portfolio context (not per filter switch).
  // Filter toggles must preserve the user's current range — bouncing 1M ↔ 1Y
  // on every chip tap is jarring (dogfooding 2026-05-29).
  useEffect(() => {
    userPickedRangeRef.current = false;
  }, [activeId]);
  useEffect(() => {
    if (userPickedRangeRef.current) return;
    const next = pickDefaultRangeForTransactions(transactions);
    if (next) setChartRange(next);
  }, [activeId, transactions]);

  const {
    data: valuation,
    isFetching: valuationFetching,
    isError: valuationError,
    dataUpdatedAt: valuationUpdatedAt,
    refreshFromLive,
  } = usePortfolioValuation(activeId, reportingCurrency);

  // Pass `undefined` portfolioId while the card is hidden so the snapshot query
  // stays disabled (no wasted Supabase fetch). The card is its only consumer.
  const dailyDelta = useDailyDelta(
    SHOW_DAILY_SNAPSHOT_CARD ? activeId : undefined,
    reportingCurrency,
    marketFilterActive ? selectedMarketFilters : undefined
  );
  const chartSeries = usePortfolioChartSeries({
    portfolioId: activeId,
    range: chartRange,
    reportingCurrency,
    liveValuation: valuation ?? undefined,
    marketFilters: marketFilterActive ? selectedMarketFilters : undefined,
  });

  const assetIds = useMemo(() => holdings.map((h) => h.assetId), [holdings]);
  const catalog = useAssetCatalog(assetIds);

  const marketLabel = useCallback(
    (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US"),
    [t]
  );

  const formatPositionLabel = useCallback(
    (shares: Decimal, market: Market, symbol: string) => {
      const qty = formatShares(shares, { decimals: 2, redact: amountsHidden });
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
    [t, amountsHidden]
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
        const change = formatChangeLine(periodChange.delta, periodChange.percent);
        return t("holdings.a11y.rowWithChange", { symbol, name, value: valueLabel, change });
      }
      return t("holdings.a11y.row", { symbol, name, value: valueLabel });
    },
    [t, formatChangeLine]
  );

  const holdingsRows = useMemo(
    () =>
      buildHoldingsTableRows({
        holdings,
        perAsset: valuation?.perAsset ?? [],
        catalog: catalog.data,
        reportingCurrency,
        amountsHidden,
        quoteLoading: valuationFetching && !valuation,
        formatPeriodChangeLine: formatChangeLine,
        positionLabel: formatPositionLabel,
        marketLabel,
        newPositionLabel: t("holdings.periodChange.newPosition"),
        formatAccessibilityLabel: formatHoldingsAccessibilityLabel,
      }),
    [
      holdings,
      valuation?.perAsset,
      valuation,
      valuationFetching,
      catalog.data,
      reportingCurrency,
      formatPositionLabel,
      formatHoldingsAccessibilityLabel,
      amountsHidden,
      t,
    ]
  );

  const marketsInPortfolio = useMemo(() => {
    const present = new Set(holdingsRows.map((r) => r.market));
    return HOLDINGS_MARKET_ORDER.filter((m) => present.has(m));
  }, [holdingsRows]);

  const filteredAndSortedHoldingsRows = useMemo(() => {
    const filtered =
      selectedMarketFilters.size === 0
        ? holdingsRows
        : holdingsRows.filter((row) => selectedMarketFilters.has(row.market));
    return sortHoldingsRows(filtered, sortKey);
  }, [holdingsRows, selectedMarketFilters, sortKey]);

  const holdingsCount = holdings.length;
  const hasHoldings = holdingsCount > 0;

  const heroTotalValue = useMemo(() => {
    if (!valuation || !hasHoldings) return ZERO;
    if (!marketFilterActive) return valuation.totalValue;
    return filterPortfolioValuation(valuation, selectedMarketFilters).totalValue;
  }, [valuation, hasHoldings, marketFilterActive, selectedMarketFilters]);

  const heroDelta =
    dailyDelta.isPending || dailyDelta.isError || !valuation ? null : dailyDelta.data;

  const chartPoints = useMemo(() => {
    return decimateChartPoints(
      snapshotsToChartPoints(
        chartSeries.data ?? [],
        marketFilterActive ? selectedMarketFilters : undefined
      )
    );
  }, [chartSeries.data, marketFilterActive, selectedMarketFilters]);

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
    const markets = marketFilterActive ? serializeMarketFilters(selectedMarketFilters) : undefined;
    router.push({
      pathname: "/portfolio/[id]/daily-snapshot",
      params: markets ? { id: activeId, markets } : { id: activeId },
    } as Href);
  }, [activeId, router, marketFilterActive, selectedMarketFilters]);

  const pricedCount = valuation?.perAsset.length ?? 0;
  const hasPartialQuotes =
    holdingsCount > 0 && pricedCount > 0 && pricedCount < holdingsCount && !valuationFetching;
  // 铁律 4：缺 FX 的持仓被排除在总值外，必须显式提示（绝不静默 1:1）
  const missingFxCount = valuation?.missingFxAssetIds.length ?? 0;

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
                formatMoney={formatAmount}
                periodChangeLabel={t(`portfolio.periodChangeByRange.${chartRange}`)}
                onPeriodChangePress={() =>
                  router.push(`/insights/pnl-analysis?range=${chartRange}` as Href)
                }
                periodChangeAccessibilityLabel={t("insights.pnl.title")}
                formatChangeLine={formatChangeLine}
                formatAnchorTime={formatAnchorTime}
                chartData={chartPoints}
                chartRange={chartRange}
                onChartRangeChange={handleChartRangeChange}
                chartLoading={chartSeries.isFetching}
                valuePrefix={currencySym}
                emptyChartMessage={t("portfolio.noSnapshotHistory")}
                totalValueAccessory={
                  <AmountVisibilityToggle
                    amountsHidden={amountsHidden}
                    onPress={toggleAmountVisibility}
                    hideAmountsLabel={t("portfolio.hideAmounts")}
                    showAmountsLabel={t("portfolio.showAmounts")}
                  />
                }
              />
              <CacheStatusBar
                dataUpdatedAt={valuationUpdatedAt || null}
                isRefreshing={valuationFetching && !!valuation}
              />
              {SHOW_DAILY_SNAPSHOT_CARD && heroDelta && heroDelta.status !== "empty-portfolio" ? (
                <DailySnapshotCard
                  delta={heroDelta}
                  title={t("dailySnapshot.title")}
                  noBaselineMessage={t("dailySnapshot.noBaseline")}
                  allNewPositionsMessage={t("dailySnapshot.allNewPositions")}
                  formatChangeLine={formatChangeLine}
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
          {missingFxCount > 0 && (
            <Text className={typographyClass("caption", "-mt-2")}>
              {t("portfolio.missingFxRates", { missing: missingFxCount })}
            </Text>
          )}
          {valuationError && (
            <Text className={typographyClass("danger", "-mt-2")}>{t("common.error")}</Text>
          )}

          {activeLoading || ensureDefaultPortfolio.isPending ? (
            <Text className={TYPO_LABEL}>{t("common.loading")}</Text>
          ) : !activePortfolio ? (
            <Card>
              <View className="items-center">
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
                rows={filteredAndSortedHoldingsRows}
                sectionTitle={t("holdings.sectionTitle")}
                headerRight={
                  <HoldingsSortControl
                    sortKey={sortKey}
                    onSortKeyChange={setSortKey}
                    options={[
                      { key: "value_desc", label: t("holdings.sort.value_desc") },
                      { key: "gain_pct_desc", label: t("holdings.sort.gain_pct_desc") },
                      { key: "gain_pct_asc", label: t("holdings.sort.gain_pct_asc") },
                      { key: "market", label: t("holdings.sort.market") },
                    ]}
                  />
                }
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
                <View className="items-center">
                  <Text className={typographyClass("emptyMessage", "mb-2")}>
                    {t("portfolio.empty")}
                  </Text>
                  <Text className={TYPO_TITLE}>{t("portfolio.emptyAction")}</Text>
                </View>
              </Pressable>
            </Card>
          )}
        </ScrollView>
      </TabScrollShadow>
    </Screen>
  );
}
