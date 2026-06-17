/**
 * /insights/risk — 风险与回撤 detail (Delta「投资组合风险」UX pattern, Arc data).
 *
 * Delta's risk page is benchmark-relative beta; Arc's beta-vs-benchmark needs the
 * deferred Tushare index adapter (#9/#11). So this page uses the risk data we DO
 * have: an underwater drawdown curve + annualized volatility / max drawdown +
 * a per-asset volatility ranking ("最具波动的资产"). Active-portfolio scoped.
 *
 * 文案铁律: states historical volatility neutrally — no "降仓 / 建议" guidance.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import Decimal from "decimal.js";
import { insights, parseAssetId, type Market } from "@arc/core";
import {
  AssetAvatar,
  Card,
  CumulativeReturnChart,
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
  type PercentAxisInput,
  type TimeRange,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { resolveAssetLogoUrl } from "../../src/lib/asset-logo-url";
import {
  useActivePortfolio,
  useAssetCatalog,
  usePortfolioValueSnapshots,
} from "../../src/lib/queries";

const pct1 = (d: Decimal): string => `${d.times(100).toFixed(1)}%`;

/** Drop leading zero-value points so a 0→value jump doesn't inflate volatility. */
const trimLeadingZeros = (series: ReadonlyArray<Decimal>): Decimal[] => {
  const first = series.findIndex((v) => v.greaterThan(0));
  return first < 0 ? [] : series.slice(first);
};

export default function RiskScreen() {
  const { t } = useTranslation();
  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;

  const [range, setRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const { data: snapshots = [] } = usePortfolioValueSnapshots(portfolioId, range);

  const valueSeries = useMemo(() => snapshots.map((s) => s.totalValue), [snapshots]);
  const hasData = valueSeries.length >= 2;
  const annualVol = useMemo(() => insights.annualizedVolatility(valueSeries, 252), [valueSeries]);
  const maxDrawdown = useMemo(() => insights.maxDrawdown(valueSeries), [valueSeries]);

  // Underwater curve: each point's drawdown from the running peak (ratio ≤ 0).
  const drawdownCurve = useMemo<ReadonlyArray<PercentAxisInput>>(() => {
    let peak = new Decimal(0);
    return snapshots.map((s) => {
      if (s.totalValue.greaterThan(peak)) peak = s.totalValue;
      const ratio = peak.greaterThan(0) ? s.totalValue.div(peak).minus(1) : new Decimal(0);
      return { ratio: ratio.toNumber(), asOf: s.asOf };
    });
  }, [snapshots]);

  // Per-asset annualized volatility ranking ("most volatile holdings").
  const riskiest = useMemo(() => {
    const latest = snapshots[snapshots.length - 1];
    if (!latest) return [];
    return [...latest.perAssetReporting.entries()]
      .filter(([, v]) => v.greaterThan(0))
      .map(([id]) => {
        const series = trimLeadingZeros(
          snapshots.map((s) => s.perAssetReporting.get(id) ?? new Decimal(0))
        );
        return { id, vol: insights.annualizedVolatility(series, 252) };
      })
      .filter((r) => r.vol.greaterThan(0))
      .sort((a, b) => b.vol.comparedTo(a.vol))
      .slice(0, 8);
  }, [snapshots]);

  const assetIds = useMemo(() => riskiest.map((r) => r.id), [riskiest]);
  const { data: catalog } = useAssetCatalog(assetIds);
  const marketLabel = (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US");

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
          {/* 年化波动率 + 最大回撤 */}
          <Card>
            <View className="flex-row">
              <View className="flex-1 gap-1">
                <Text className={`${TYPO_CAPTION} text-muted`}>{t("insights.risk.title")}</Text>
                <Text className={TYPO_METRIC}>{hasData ? pct1(annualVol) : "—"}</Text>
                <Text className={`${TYPO_CAPTION} text-muted`}>
                  {t("insights.risk.volatilityShort")}
                </Text>
              </View>
              <View className="flex-1 gap-1">
                <Text className={`${TYPO_CAPTION} text-muted`}>{t("insights.drawdown.title")}</Text>
                <Text className={TYPO_METRIC}>
                  {!hasData
                    ? "—"
                    : maxDrawdown.isZero()
                      ? pct1(maxDrawdown)
                      : `-${pct1(maxDrawdown)}`}
                </Text>
                <Text className={`${TYPO_CAPTION} text-muted`}>
                  {t("insights.drawdown.maxLabel")}
                </Text>
              </View>
            </View>
          </Card>

          {/* 回撤水下曲线 */}
          <View className="gap-3">
            <Text className={TYPO_OVERLINE}>{t("insights.drawdown.curveTitle")}</Text>
            <TimeRangeSelector value={range} onChange={setRange} />
            <CumulativeReturnChart
              data={drawdownCurve}
              emptyLabel={t("insights.pnl.chart.empty")}
              formatScrubDate={(iso) => iso.slice(0, 10)}
            />
          </View>

          {/* 波动最高的资产 */}
          {riskiest.length > 0 ? (
            <View className="gap-1">
              <Text className={TYPO_OVERLINE}>{t("insights.risk.riskiestAssetsTitle")}</Text>
              {riskiest.map((r) => {
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
