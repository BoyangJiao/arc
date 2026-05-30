/**
 * PortfolioInsightCardLoader — fetches per-portfolio insight data for Insights dashboard.
 */

import { useEffect, useMemo } from "react";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import { PortfolioInsightCard, TwrInlineLabel, formatSignedPercent, type PnlSign } from "@arc/ui";
import type { Portfolio } from "@arc/core";
import { useTranslation } from "@arc/i18n";

import { formatMoney } from "../lib/format-money";
import { useAmountRedacted } from "../lib/use-amount-redacted";
import { assetLabel, toDonutSegments } from "../lib/rebalance-format";
import {
  claimInsightsSessionLiveFetch,
  insightsSessionValuationKey,
} from "../lib/insights-session-valuation";
import { isCacheFirstMarketData } from "../lib/market-data-policy";
import {
  useActivePortfolio,
  useDailyDelta,
  usePortfolioTwr,
  usePortfolioValuation,
  useRebalance,
} from "../lib/queries";

const INSIGHT_TWR_RANGE = "1M" as const;

const parseCashKey = (assetId: string): string => {
  const parts = assetId.split(":");
  return parts.length >= 2 ? parts[1]! : assetId;
};

export const PortfolioInsightCardLoader = ({ portfolio }: { portfolio: Portfolio }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { amountsHidden } = useAmountRedacted();
  const { activePortfolioId } = useActivePortfolio();
  const reportingCurrency = portfolio.reportingCurrency;

  const { data: valuation, isPending: valuationPending } = usePortfolioValuation(
    portfolio.id,
    reportingCurrency
  );
  const {
    deviations,
    targets,
    holdings,
    isLoading: rebalanceLoading,
    refreshFromLive,
  } = useRebalance(portfolio.id, reportingCurrency);
  const dailyDelta = useDailyDelta(portfolio.id, reportingCurrency);
  const portfolioTwr = usePortfolioTwr({ portfolioId: portfolio.id, range: INSIGHT_TWR_RANGE });

  const hasTargets = targets.length > 0;
  const isActive = activePortfolioId === portfolio.id;

  // Cache-first → live refresh on mount, once per session, for the active
  // portfolio only (ADR 007 real-link; folded in from the old active panel).
  useEffect(() => {
    if (!isActive || holdings.length === 0 || !hasTargets || !isCacheFirstMarketData()) return;
    const key = insightsSessionValuationKey(portfolio.id, reportingCurrency);
    if (!claimInsightsSessionLiveFetch(key)) return;
    void refreshFromLive();
  }, [isActive, holdings.length, hasTargets, portfolio.id, reportingCurrency, refreshFromLive]);

  const labelFor = (assetId: string) =>
    assetLabel(assetId, t(`rebalance.cashNames.${parseCashKey(assetId)}` as const));

  const targetDonut = useMemo(
    () =>
      toDonutSegments(
        deviations.map((d) => ({
          assetId: d.assetId,
          label: labelFor(d.assetId),
          percent: d.targetPercent,
        }))
      ),
    [deviations, t]
  );

  const currentDonut = useMemo(
    () =>
      toDonutSegments(
        deviations.map((d) => ({
          assetId: d.assetId,
          label: labelFor(d.assetId),
          percent: d.currentPercent,
        }))
      ),
    [deviations, t]
  );

  const maxDeviation = deviations.reduce(
    (max, d) => (d.deviationPercent.abs().gt(max) ? d.deviationPercent.abs() : max),
    new Decimal(0)
  );

  const rebalanceCount = deviations.filter((d) => !d.sharesNeeded.isZero()).length;

  const todayDelta = dailyDelta.data?.status === "ok" ? dailyDelta.data.totalDeltaPercent : null;
  const todayChange = todayDelta ? formatSignedPercent(todayDelta) : "—";
  const todaySign: PnlSign =
    !todayDelta || todayDelta.isZero() ? "neutral" : todayDelta.isNegative() ? "loss" : "gain";

  const setupHref = `/insights/rebalance/setup?portfolioId=${portfolio.id}` as Href;
  const actionsHref = `/insights/rebalance/actions?portfolioId=${portfolio.id}` as Href;

  return (
    <PortfolioInsightCard
      portfolioName={portfolio.name}
      reportingCurrency={portfolio.reportingCurrency}
      isActive={isActive}
      activeChipLabel={t("portfolios.activeChip")}
      totalValueLabel={
        valuationPending
          ? t("common.loading")
          : formatMoney(valuation?.totalValue ?? new Decimal(0), reportingCurrency, {
              redact: amountsHidden,
            })
      }
      todayChangeLabel={t("portfolios.insightTodayChange", { change: todayChange })}
      todayChangeSign={todaySign}
      deviationLabel={t("portfolios.insightDeviation", {
        percent: maxDeviation.toFixed(1),
      })}
      rebalanceCountLabel={t("portfolios.insightRebalanceCount", {
        count: rebalanceCount,
      })}
      hasTargets={hasTargets}
      noTargetsTitle={t("portfolios.insightNoTargets")}
      noTargetsCta={t("portfolios.insightSetupTargets")}
      viewActionsCta={t("portfolios.insightViewActions")}
      adjustTargetsCta={t("portfolios.insightAdjustTargets")}
      targetSegments={targetDonut}
      currentSegments={currentDonut}
      isLoading={valuationPending || rebalanceLoading}
      twrInline={
        <TwrInlineLabel
          range={INSIGHT_TWR_RANGE}
          result={portfolioTwr.isError ? undefined : portfolioTwr.data}
          loading={portfolioTwr.isLoading}
          unavailable={t("twr.unavailable")}
          twrAbbrevLabel={t("twr.label")}
          tooltipTitle={t("twr.tooltipTitle")}
          tooltipBody={t("twr.tooltipBody")}
          closeLabel={t("common.close")}
        />
      }
      onViewActionsPress={() => router.push(actionsHref)}
      onSetupTargetsPress={() => router.push(setupHref)}
    />
  );
};
