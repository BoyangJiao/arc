/**
 * /insights/attribution — 业绩归因 / Performance Attribution (Insights #8).
 *
 * Per-asset P&L contribution over the selected period (amount basis, 用户决策):
 * each asset's signed reporting-currency contribution = ΔValue − netInflow +
 * dividends (returns/period-pnl.ts §决策 6), which RECONCILES — Σ contributions =
 * the period's total P&L. Splits assets into 贡献 (positive) and 拖累 (negative)
 * with subtotals, full list (vs the top-5 movers card on 盈亏分析). Active-portfolio
 * scoped.
 *
 * 文案铁律: states historical contribution neutrally — no buy/sell guidance.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import { parseAssetId, type Market } from "@arc/core";
import {
  Card,
  DEFAULT_TIME_RANGE,
  InScreenHeader,
  InfoTooltipButton,
  RankingRow,
  Screen,
  Separator,
  Text,
  TimeRangeSelector,
  formatCompactChangeLine,
  formatSignedPercent,
  pnlTextClass,
  scrollContentBelowInScreenHeader,
  useBusinessClasses,
  TYPO_CAPTION,
  TYPO_METRIC,
  TYPO_OVERLINE,
  type PnlSign,
  type TimeRange,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { resolveAssetLogoUrl } from "../../src/lib/asset-logo-url";
import { currencySymbol } from "../../src/lib/format-money";
import { useActivePortfolio, useAssetCatalog, usePnlAnalysis } from "../../src/lib/queries";
import { useAmountRedacted } from "../../src/lib/use-amount-redacted";
import { useUserPreferences } from "../../src/lib/user-preferences";

const ZERO = new Decimal(0);
const signOf = (v: Decimal): PnlSign => (v.isZero() ? "neutral" : v.isNegative() ? "loss" : "gain");

export default function AttributionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const classes = useBusinessClasses();
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";
  const sym = currencySymbol(reportingCurrency);

  const [range, setRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const { activePortfolioId } = useActivePortfolio();
  const portfolioId = activePortfolioId ?? undefined;

  const { data } = usePnlAnalysis({ portfolioId, range });
  const contributions = data?.result.perAssetContribution ?? [];

  const assetIds = useMemo(() => contributions.map((c) => c.assetId), [contributions]);
  const { data: catalog } = useAssetCatalog(assetIds);
  const marketLabel = (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US");

  const signedAmount = (amount: Decimal): string =>
    formatCompactChangeLine(amount, null, sym, { redactAmount: amountsHidden });

  const { contributors, detractors, total } = useMemo(() => {
    const pos = contributions.filter((c) => c.contribution.isPositive());
    const neg = contributions.filter((c) => c.contribution.isNegative());
    const sum = contributions.reduce((s, c) => s.plus(c.contribution), ZERO);
    return { contributors: pos, detractors: neg, total: sum };
  }, [contributions]);

  const hasData = contributions.length > 0;

  const renderSection = (
    titleKey: "insights.attribution.contributorsTitle" | "insights.attribution.detractorsTitle",
    rows: typeof contributions
  ) => {
    if (rows.length === 0) return null;
    const subtotal = rows.reduce((s, c) => s.plus(c.contribution), ZERO);
    return (
      <View className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className={TYPO_OVERLINE}>{t(titleKey)}</Text>
          <Text className={pnlTextClass(signOf(subtotal), classes)}>{signedAmount(subtotal)}</Text>
        </View>
        {rows.map((c) => {
          const { market, symbol } = parseAssetId(c.assetId);
          return (
            <RankingRow
              key={c.assetId}
              name={catalog?.get(c.assetId)?.name ?? symbol}
              symbol={symbol}
              market={market}
              marketLabel={marketLabel(market)}
              imageUrl={resolveAssetLogoUrl(market, symbol)}
              symbolLabel={`${marketLabel(market)} · ${symbol}`}
              contributionLabel={signedAmount(c.contribution)}
              sign={signOf(c.contribution)}
              rightSubLabel={[
                c.ratio === null
                  ? t("insights.pnl.ranking.newPositionBadge")
                  : formatSignedPercent(c.ratio.times(100)),
                c.realized.isZero()
                  ? null
                  : `${t("insights.attribution.realizedTag")} ${signedAmount(c.realized)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              onPress={() => router.push(`/asset/${market}/${symbol}` as Href)}
            />
          );
        })}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader
          title={t("insights.attribution.detailTitle")}
          leftType="back"
          rightSlot={
            <InfoTooltipButton
              title={t("insights.attribution.detailTitle")}
              body={t("insights.attribution.info")}
              closeLabel={t("insights.pnl.tooltipClose")}
            />
          }
        />
        <View className="gap-6 pb-10">
          <TimeRangeSelector value={range} onChange={setRange} />

          <Card>
            <View className="gap-1">
              <Text className={`${TYPO_CAPTION} text-muted`}>
                {t("insights.attribution.totalLabel")}
              </Text>
              <Text className={`${TYPO_METRIC} ${pnlTextClass(signOf(total), classes)}`}>
                {hasData ? signedAmount(total) : "—"}
              </Text>
              <Text className={`${TYPO_CAPTION} text-muted`}>
                {t("insights.attribution.reconcileHint")}
              </Text>
            </View>
          </Card>

          {hasData ? (
            <>
              {renderSection("insights.attribution.contributorsTitle", contributors)}
              {renderSection("insights.attribution.detractorsTitle", detractors)}
            </>
          ) : (
            <Text className="text-muted text-sm text-center py-6">
              {t("insights.pnl.ranking.empty")}
            </Text>
          )}

          <Separator />
          <Text className="text-muted text-xs text-center">
            {t("insights.attribution.disclaimer")}
          </Text>
        </View>
      </Screen>
    </>
  );
}
