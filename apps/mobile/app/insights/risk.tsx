/**
 * /insights/risk — 风险 detail (Delta「投资组合风险」UX pattern, Arc data).
 *
 * Two cash-flow-neutral risk metrics (computed on flow-free returns, robust to
 * buys/sells and partial/anachronistic snapshots — see portfolio-risk-series.ts):
 * annualized volatility, and beta vs a benchmark (#11, reuses the 指数对标 #9 proxy
 * close series). Plus a prominent per-asset volatility bar chart + "most volatile
 * assets" ranking. Drawdown is its own page (/insights/drawdown). Active-portfolio
 * scoped.
 *
 * 文案铁律: states historical volatility / beta neutrally — no "降仓 / 建议" guidance.
 */

import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Stack } from "expo-router";
import Decimal from "decimal.js";
import { insights, parseAssetId, type Market } from "@arc/core";
import {
  AssetAvatar,
  BarChart,
  Card,
  DEFAULT_TIME_RANGE,
  InScreenHeader,
  InfoTooltipButton,
  Screen,
  Separator,
  Text,
  TimeRangeSelector,
  TYPO_CAPTION,
  TYPO_METRIC,
  TYPO_OVERLINE,
  TYPO_ROW_TITLE,
  TYPO_ROW_VALUE,
  scrollContentBelowInScreenHeader,
  type TimeRange,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { resolveAssetLogoUrl } from "../../src/lib/asset-logo-url";
import {
  BENCHMARKS,
  benchmarkById,
  defaultBenchmarkId,
  PORTFOLIO_COLOR,
} from "../../src/lib/benchmark-catalog";
import {
  useActivePortfolio,
  useAssetCatalog,
  usePortfolioBeta,
  usePortfolioRiskSeries,
  useEmptyRiskSeriesView,
} from "../../src/lib/queries";

const pct1 = (d: Decimal): string => `${d.times(100).toFixed(1)}%`;

export default function RiskScreen() {
  const { t } = useTranslation();
  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;

  const [range, setRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const emptyView = useEmptyRiskSeriesView();
  const { data: series = emptyView } = usePortfolioRiskSeries({ portfolioId, range });

  // Cash-flow-adjusted: volatility on market-only returns, not raw totalValue.
  const hasData = series.portfolioReturns.length >= 2;
  const annualVol = useMemo(
    () => insights.volatilityFromReturns(series.portfolioReturns, 252),
    [series.portfolioReturns]
  );

  // Per-asset annualized volatility ranking ("most volatile holdings").
  const perAsset = useMemo(() => {
    return [...series.latestHoldings.entries()]
      .filter(([, v]) => v.greaterThan(0))
      .map(([id]) => ({
        id,
        symbol: parseAssetId(id).symbol,
        vol: insights.volatilityFromReturns(series.perAsset.get(id)?.returns ?? [], 252),
      }))
      .filter((r) => r.vol.greaterThan(0))
      .sort((a, b) => b.vol.comparedTo(a.vol))
      .slice(0, 8);
  }, [series]);

  // Beta vs a benchmark (#11): default by reporting currency, user can switch.
  const [benchmarkId, setBenchmarkId] = useState<string>(() =>
    defaultBenchmarkId(portfolio?.reportingCurrency ?? "CNY")
  );
  const [benchmarkPicked, setBenchmarkPicked] = useState(false);
  useEffect(() => {
    if (!benchmarkPicked && portfolio)
      setBenchmarkId(defaultBenchmarkId(portfolio.reportingCurrency));
  }, [benchmarkPicked, portfolio]);

  const { data: betaResult } = usePortfolioBeta({ portfolioId, range, benchmarkId });
  const benchmarkName = (id: string) =>
    t(
      `insights.benchmark.names.${benchmarkById(id)?.nameKey ?? id}` as "insights.benchmark.names.SPX"
    );

  const { data: catalog } = useAssetCatalog(useMemo(() => perAsset.map((r) => r.id), [perAsset]));
  const marketLabel = (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US");

  const barData = useMemo(
    () => perAsset.slice(0, 6).map((r) => ({ label: r.symbol, vol: r.vol.times(100).toNumber() })),
    [perAsset]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader
          title={t("insights.risk.detailTitle")}
          leftType="back"
          rightSlot={
            <InfoTooltipButton
              title={t("insights.risk.detailTitle")}
              body={t("insights.risk.info")}
              closeLabel={t("insights.pnl.tooltipClose")}
            />
          }
        />
        <View className="gap-6 pb-10">
          <TimeRangeSelector value={range} onChange={setRange} />

          <Card>
            <View className="gap-1">
              <Text className={`${TYPO_CAPTION} text-muted`}>
                {t("insights.risk.volatilityShort")}
              </Text>
              <Text className={TYPO_METRIC}>{hasData ? pct1(annualVol) : "—"}</Text>
            </View>
          </Card>

          {/* Beta vs benchmark (#11). */}
          <View className="gap-3">
            <Card>
              <View className="gap-1">
                <Text className={`${TYPO_CAPTION} text-muted`}>{t("insights.risk.betaLabel")}</Text>
                <Text className={TYPO_METRIC}>
                  {betaResult?.beta != null ? betaResult.beta.toFixed(2) : "—"}
                </Text>
                <Text className={`${TYPO_CAPTION} text-muted`}>
                  {t("insights.risk.betaVs", { benchmark: benchmarkName(benchmarkId) })}
                  {betaResult && betaResult.sampleSize > 0 && betaResult.sampleSize < 10
                    ? ` · ${t("insights.risk.betaLowConfidence")}`
                    : ""}
                </Text>
              </View>
            </Card>
            <View className="flex-row flex-wrap gap-2">
              {BENCHMARKS.map((b) => {
                const active = b.id === benchmarkId;
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setBenchmarkPicked(true);
                      setBenchmarkId(b.id);
                    }}
                    className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border active:opacity-70 ${
                      active ? "bg-surface-secondary border-foreground/30" : "border-border"
                    }`}
                  >
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: b.color ?? PORTFOLIO_COLOR,
                        opacity: active ? 1 : 0.4,
                      }}
                    />
                    <Text className={active ? "text-foreground text-sm" : "text-muted text-sm"}>
                      {benchmarkName(b.id)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {barData.length > 0 ? (
            <View className="gap-3">
              <Text className={TYPO_OVERLINE}>{t("insights.risk.byAssetTitle")}</Text>
              <BarChart data={barData} xKey="label" series={[{ key: "vol" }]} height={224} />
            </View>
          ) : null}

          {perAsset.length > 0 ? (
            <View className="gap-1">
              <Text className={TYPO_OVERLINE}>{t("insights.risk.riskiestAssetsTitle")}</Text>
              {perAsset.map((r) => {
                const { market, symbol } = parseAssetId(r.id);
                const name = catalog?.get(r.id)?.name ?? symbol;
                return (
                  <View key={r.id} className="flex-row items-center gap-3 py-2.5">
                    <AssetAvatar
                      symbol={symbol}
                      market={market}
                      marketLabel={marketLabel(market)}
                      imageUrl={resolveAssetLogoUrl(market, symbol)}
                      size={36}
                    />
                    <View className="flex-1 min-w-0">
                      <Text className={TYPO_ROW_TITLE} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text className={`${TYPO_CAPTION} text-muted`} numberOfLines={1}>
                        {`${marketLabel(market)} · ${symbol}`}
                      </Text>
                    </View>
                    <Text className={TYPO_ROW_VALUE}>{pct1(r.vol)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Separator />
          <Text className="text-muted text-xs text-center">{t("insights.risk.disclaimer")}</Text>
        </View>
      </Screen>
    </>
  );
}
