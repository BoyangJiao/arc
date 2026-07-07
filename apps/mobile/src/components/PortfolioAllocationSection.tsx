/**
 * PortfolioAllocationSection — per-portfolio 资产配置 group on the Insights tab.
 *
 * IA: 再平衡 / 市场敞口 / 币种敞口 all belong to "资产配置", so they share one
 * section header (title + portfolio chip). 再平衡 stays a full-width card (its own
 * row) — donut = TARGET allocation (the configured targets, matching the drift /
 * adjustment lists) + drift summary; tap → action list. 市场/币种 are compact
 * tiles whose donuts use live valuation exposure.
 */

import { useEffect, useMemo } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import {
  ALLOCATION_PALETTE,
  Card,
  DonutChart,
  ExposureSummaryTile,
  NAVIGATION_COLORS,
  Text,
  TYPO_CAPTION,
  TYPO_LABEL,
  TYPO_ROW_TITLE,
  TYPO_SECTION_TITLE,
  type DonutChartDatum,
} from "@arc/ui";
import { insights, type Portfolio } from "@arc/core";
import { useTranslation } from "@arc/i18n";

import { assetLabel } from "../lib/rebalance-format";
import {
  claimInsightsSessionLiveFetch,
  insightsSessionValuationKey,
} from "../lib/insights-session-valuation";
import { isCacheFirstMarketData } from "../lib/market-data-policy";
import {
  useActivePortfolio,
  usePortfolioValuation,
  useRebalance,
  useTransactions,
} from "../lib/queries";
import { useColorMode } from "../lib/theme";

const parseCashKey = (assetId: string): string => {
  const parts = assetId.split(":");
  return parts.length >= 2 ? parts[1]! : assetId;
};

const formatPct = (w: Decimal): string => `${w.times(100).toFixed(0)}%`;
const color = (i: number): string => ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length]!;

export const PortfolioAllocationSection = ({ portfolio }: { portfolio: Portfolio }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorMode } = useColorMode();
  const insetColor = NAVIGATION_COLORS[colorMode].card;
  const { activePortfolioId } = useActivePortfolio();
  const isActive = activePortfolioId === portfolio.id;
  const reportingCurrency = portfolio.reportingCurrency;

  const { data: valuation } = usePortfolioValuation(portfolio.id, reportingCurrency);
  const { deviations, targets, holdings, refreshFromLive } = useRebalance(
    portfolio.id,
    reportingCurrency
  );
  const hasTargets = targets.length > 0;

  // Cache-first → live refresh on mount, once per session, active portfolio only (ADR 007).
  useEffect(() => {
    if (!isActive || holdings.length === 0 || !hasTargets || !isCacheFirstMarketData()) return;
    const key = insightsSessionValuationKey(portfolio.id, reportingCurrency);
    if (!claimInsightsSessionLiveFetch(key)) return;
    void refreshFromLive();
  }, [isActive, holdings.length, hasTargets, portfolio.id, reportingCurrency, refreshFromLive]);

  const labelFor = (assetId: string) =>
    assetLabel(
      assetId,
      t(`rebalance.cashNames.${parseCashKey(assetId)}` as "rebalance.cashNames.USD")
    );
  const marketLabel = (g: string) => t(`holdings.markets.${g}` as "holdings.markets.US");
  const currencyLabel = (g: string) => t(`insights.currencies.${g}` as "insights.currencies.CNY");

  const perAsset = valuation?.perAsset ?? [];

  // 再平衡 donut = TARGET allocation (the configured targets) — matches the drift /
  // adjustment lists exactly, so the slice count == your rebalance config.
  const rebalanceDonut = useMemo<DonutChartDatum[]>(
    () =>
      targets.map((tg, i) => ({
        key: labelFor(tg.assetId),
        value: tg.targetPercent.toNumber(),
        color: color(i),
      })),
    [targets, t]
  );

  const { data: transactions = [] } = useTransactions(portfolio.id);

  const market = useMemo(() => insights.marketExposure(perAsset), [valuation]);
  const currency = useMemo(() => insights.currencyExposure(perAsset), [valuation]);
  const account = useMemo(
    () => insights.accountExposure(perAsset, transactions),
    [valuation, transactions]
  );
  const accountLabel = (g: string) =>
    g === insights.ACCOUNT_UNASSIGNED ? t("insights.exposure.unassignedAccount") : g;
  // Only surface 资产位置 once the user has tagged at least one real account.
  const hasAccountData = account.some((s) => s.group !== insights.ACCOUNT_UNASSIGNED);
  const marketData: DonutChartDatum[] = market.map((s, i) => ({
    key: marketLabel(s.group),
    value: s.value.toNumber(),
    color: color(i),
  }));
  const currencyData: DonutChartDatum[] = currency.map((s, i) => ({
    key: currencyLabel(s.group),
    value: s.value.toNumber(),
    color: color(i),
  }));
  const accountData: DonutChartDatum[] = account.map((s, i) => ({
    key: accountLabel(s.group),
    value: s.value.toNumber(),
    color: color(i),
  }));

  const maxDeviation = deviations.reduce(
    (max, d) => (d.deviationPercent.abs().gt(max) ? d.deviationPercent.abs() : max),
    new Decimal(0)
  );
  const rebalanceCount = deviations.filter((d) => !d.sharesNeeded.isZero()).length;

  const go = (href: string) => router.push(href as Href);
  const rebalanceHref = hasTargets
    ? `/insights/rebalance/actions?portfolioId=${portfolio.id}`
    : `/insights/rebalance/setup?portfolioId=${portfolio.id}`;

  return (
    <View className="gap-3">
      <View className="px-0.5">
        <Text className={TYPO_SECTION_TITLE}>{t("insights.allocation.title")}</Text>
      </View>

      {/* 再平衡 — full-width card (own row) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("rebalance.cardTitle")} ${portfolio.name}`}
        onPress={() => go(rebalanceHref)}
        className="active:opacity-70"
      >
        <Card>
          <View className="gap-3">
            <Text className={TYPO_LABEL}>{t("rebalance.cardTitle")}</Text>
            {hasTargets ? (
              <View className="gap-4">
                <DonutChart
                  data={rebalanceDonut}
                  heightClass="h-56"
                  insetColor={insetColor}
                  center={
                    <View className="items-center">
                      <Text className={TYPO_ROW_TITLE}>{`${maxDeviation.toFixed(1)}%`}</Text>
                      <Text className={`${TYPO_CAPTION} text-muted`}>
                        {t("insights.allocation.maxDeviation")}
                      </Text>
                    </View>
                  }
                />
                <Text className={`${TYPO_CAPTION} text-muted`}>
                  {t("portfolios.insightRebalanceCount", { count: rebalanceCount })}
                </Text>
              </View>
            ) : (
              <View className="gap-1.5">
                <Text className={`${TYPO_CAPTION} text-muted`}>
                  {t("portfolios.insightNoTargets")}
                </Text>
                <Text className={`${TYPO_CAPTION} text-foreground font-medium`}>
                  {t("portfolios.insightSetupTargets")}
                </Text>
              </View>
            )}
          </View>
        </Card>
      </Pressable>

      {/* 市场敞口 | 币种敞口 — compact tiles */}
      <View className="flex-row gap-3">
        <ExposureSummaryTile
          title={t("insights.exposure.marketTitle")}
          data={marketData}
          insetColor={insetColor}
          topLabel={market[0] ? marketLabel(market[0].group) : undefined}
          topPercent={market[0] ? formatPct(market[0].weight) : undefined}
          emptyLabel={t("insights.exposure.empty")}
          onPress={() => go(`/insights/exposure/market?portfolioId=${portfolio.id}`)}
        />
        <ExposureSummaryTile
          title={t("insights.exposure.currencyTitle")}
          tier="pro"
          data={currencyData}
          insetColor={insetColor}
          topLabel={currency[0] ? currencyLabel(currency[0].group) : undefined}
          topPercent={currency[0] ? formatPct(currency[0].weight) : undefined}
          emptyLabel={t("insights.exposure.empty")}
          onPress={() => go(`/insights/exposure/currency?portfolioId=${portfolio.id}`)}
        />
      </View>

      {/* 资产位置敞口 — appears once holdings carry an account/platform tag (#12) */}
      {hasAccountData ? (
        <View className="flex-row gap-3">
          <ExposureSummaryTile
            title={t("insights.exposure.accountTitle")}
            tier="pro"
            data={accountData}
            insetColor={insetColor}
            topLabel={account[0] ? accountLabel(account[0].group) : undefined}
            topPercent={account[0] ? formatPct(account[0].weight) : undefined}
            emptyLabel={t("insights.exposure.empty")}
            onPress={() => go(`/insights/exposure/account?portfolioId=${portfolio.id}`)}
          />
        </View>
      ) : null}
    </View>
  );
};
