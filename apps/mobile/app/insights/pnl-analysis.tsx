/**
 * /insights/pnl-analysis — 盈亏分析 detail page (Insights P&L module).
 *
 * Spec: .specify/feature-specs/stage-3/pnl-analysis-insights.md (Commit 6).
 *
 * Three cards: 时段盈亏 (period, range-dependent) + 累计盈亏 (cumulative,
 * range-INDEPENDENT, AC.2.2) + 盈亏排行 (movers, range-dependent). Range inits
 * from the ?range= query param (Hero chip) else DEFAULT_TIME_RANGE (AC.2.3/2.4).
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import type Decimal from "decimal.js";
import { parseAssetId } from "@arc/core";
import {
  DEFAULT_TIME_RANGE,
  InScreenHeader,
  PnlCumulativeCard,
  PnlPeriodCard,
  PnlRankingCard,
  Screen,
  TIME_RANGE_OPTIONS,
  TimeRangeSelector,
  Text,
  formatCompactChangeLine,
  formatSignedPercent,
  scrollContentBelowInScreenHeader,
  type PercentAxisInput,
  type PnlMetricRow,
  type PnlRankingRowData,
  type PnlRankingTab,
  type PnlSign,
  type TimeRange,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { buildCumulativePnlSummary } from "../../src/lib/pnl-presenter";
import { currencySymbol, formatMoney } from "../../src/lib/format-money";
import {
  useActivePortfolio,
  useAssetCatalog,
  usePnlAnalysis,
  usePortfolioHoldings,
  usePortfolioValuation,
} from "../../src/lib/queries";
import { useAmountRedacted } from "../../src/lib/use-amount-redacted";
import { useUserPreferences } from "../../src/lib/user-preferences";

const signOf = (value: Decimal | null | undefined): PnlSign =>
  !value || value.isZero() ? "neutral" : value.isNegative() ? "loss" : "gain";

const isTimeRange = (value: string | undefined): value is TimeRange =>
  !!value && (TIME_RANGE_OPTIONS as readonly string[]).includes(value);

export default function PnlAnalysisScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";
  const sym = currencySymbol(reportingCurrency);

  const { range: rangeParam } = useLocalSearchParams<{ range?: string }>();
  const [range, setRange] = useState<TimeRange>(
    isTimeRange(rangeParam) ? rangeParam : DEFAULT_TIME_RANGE
  );
  const [rankingTab, setRankingTab] = useState<PnlRankingTab>("winners");

  const { activePortfolioId } = useActivePortfolio();
  const portfolioId = activePortfolioId ?? undefined;

  const pnlQuery = usePnlAnalysis({ portfolioId, range });
  const valuationQuery = usePortfolioValuation(portfolioId, reportingCurrency);
  const { holdings } = usePortfolioHoldings(portfolioId);

  const result = pnlQuery.data?.result;
  const valuation = valuationQuery.data ?? null;

  const assetIds = useMemo(
    () => (result ? result.perAssetContribution.map((c) => c.assetId) : []),
    [result]
  );
  const { data: catalog } = useAssetCatalog(assetIds);

  const money = (amount: Decimal): string =>
    formatMoney(amount, reportingCurrency, { redact: amountsHidden });
  const signedAmount = (amount: Decimal): string =>
    formatCompactChangeLine(amount, null, sym, { redactAmount: amountsHidden });

  // ─── 时段盈亏 ────────────────────────────────────────────────────────────
  const chartData: ReadonlyArray<PercentAxisInput> = useMemo(
    () =>
      result
        ? result.returnCurve.map((p) => ({ ratio: p.ratio.toNumber(), asOf: p.date.toISOString() }))
        : [],
    [result]
  );

  const dateRangeLabel = pnlQuery.data
    ? t("insights.pnl.periodValueChange.dateRange", {
        from: pnlQuery.data.from.toISOString().slice(0, 10),
        to: pnlQuery.data.to.toISOString().slice(0, 10),
      })
    : "";

  const metrics: ReadonlyArray<PnlMetricRow> = result
    ? [
        {
          key: "mwr",
          label: t("insights.pnl.metrics.mwr"),
          value: result.mwrPeriod ? formatSignedPercent(result.mwrPeriod.times(100)) : "—",
          sign: signOf(result.mwrPeriod),
          tooltip: {
            title: t("insights.pnl.metrics.mwrTooltipTitle"),
            body: t("insights.pnl.metrics.mwrTooltip"),
            closeLabel: t("insights.pnl.tooltipClose"),
          },
        },
        {
          key: "annualized",
          label: t("insights.pnl.metrics.annualized"),
          value: result.mwrAnnualized ? formatSignedPercent(result.mwrAnnualized.times(100)) : "—",
          sign: signOf(result.mwrAnnualized),
          tooltip: {
            title: t("insights.pnl.metrics.annualizedTooltipTitle"),
            body: t("insights.pnl.metrics.annualizedTooltip"),
            closeLabel: t("insights.pnl.tooltipClose"),
          },
        },
        {
          key: "realized",
          label: t("insights.pnl.metrics.realized"),
          value: signedAmount(result.realizedPnL),
          sign: signOf(result.realizedPnL),
          tooltip: {
            title: t("insights.pnl.metrics.realizedTooltipTitle"),
            body: t("insights.pnl.metrics.realizedTooltip"),
            closeLabel: t("insights.pnl.tooltipClose"),
          },
        },
      ]
    : [];

  // ─── 累计盈亏 (range-independent) ────────────────────────────────────────
  const cumulative = valuation ? buildCumulativePnlSummary(valuation, holdings) : null;

  // ─── 盈亏排行 ────────────────────────────────────────────────────────────
  const toRow = (c: {
    assetId: string;
    contribution: Decimal;
    ratio: Decimal | null;
  }): PnlRankingRowData => {
    const { market, symbol } = parseAssetId(c.assetId);
    const name = catalog?.get(c.assetId)?.name ?? symbol;
    return {
      assetId: c.assetId,
      name,
      symbolLabel: `${market} · ${symbol}`,
      contributionLabel: signedAmount(c.contribution),
      sign: signOf(c.contribution),
      rightSubLabel:
        c.ratio === null
          ? t("insights.pnl.ranking.newPositionBadge")
          : formatSignedPercent(c.ratio.times(100)),
    };
  };

  const rankingRows: ReadonlyArray<PnlRankingRowData> = useMemo(() => {
    if (!result) return [];
    const winners = result.perAssetContribution.filter((c) => c.contribution.isPositive());
    const losers = result.perAssetContribution.filter((c) => c.contribution.isNegative());
    const picked = (rankingTab === "winners" ? winners : losers).slice(0, 5);
    return picked.map(toRow);
  }, [result, rankingTab, catalog, amountsHidden]);

  const handleRowPress = (assetId: string) => {
    const { market, symbol } = parseAssetId(assetId);
    router.push(`/asset/${market}/${symbol}` as Href);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader title={t("insights.pnl.title")} leftType="back" />
        <View className="px-4 gap-4 pb-10">
          <TimeRangeSelector value={range} onChange={setRange} />

          <PnlPeriodCard
            sectionTitle={t("insights.pnl.section.period")}
            periodLabel={t("insights.pnl.periodValueChange.title", { period: range })}
            valueChangeLabel={result ? signedAmount(result.valueChange) : "—"}
            valueChangeSign={signOf(result?.valueChange)}
            dateRangeLabel={dateRangeLabel}
            chartData={chartData}
            chartLoading={pnlQuery.isPending}
            chartEmptyLabel={t("insights.pnl.chart.empty")}
            metrics={metrics}
          />

          <PnlCumulativeCard
            sectionTitle={t("insights.pnl.section.cumulative")}
            tooltip={{
              title: t("insights.pnl.cumulative.tooltipTitle"),
              body: t("insights.pnl.cumulative.tooltip"),
              closeLabel: t("insights.pnl.tooltipClose"),
            }}
            holdingReturnLabelText={t("insights.pnl.cumulative.holdingReturn")}
            holdingReturnLabel={cumulative ? signedAmount(cumulative.holdingReturn) : "—"}
            holdingReturnPercentLabel={
              cumulative?.holdingReturnPercent
                ? formatSignedPercent(cumulative.holdingReturnPercent)
                : undefined
            }
            holdingReturnSign={signOf(cumulative?.holdingReturn)}
            totalInvestedLabelText={t("insights.pnl.cumulative.totalInvested")}
            totalInvestedValue={cumulative ? money(cumulative.totalInvested) : "—"}
            totalValueLabelText={t("insights.pnl.cumulative.totalValue")}
            totalValueValue={cumulative ? money(cumulative.totalValue) : "—"}
          />

          <PnlRankingCard
            sectionTitle={t("insights.pnl.section.ranking")}
            winnersTabLabel={t("insights.pnl.ranking.winnersTab")}
            losersTabLabel={t("insights.pnl.ranking.losersTab")}
            activeTab={rankingTab}
            onTabChange={setRankingTab}
            rows={rankingRows}
            emptyLabel={t("insights.pnl.ranking.empty")}
            onRowPress={handleRowPress}
          />

          <Text className="text-muted text-xs text-center">{t("insights.pnl.disclaimer")}</Text>
        </View>
      </Screen>
    </>
  );
}
