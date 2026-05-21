/**
 * InsightsActiveRebalancePanel — Stage 2 J9 rebalance analysis for the active portfolio.
 *
 * Block B keeps per-portfolio insight cards; this panel restores the full DeviationDonut
 * + DeviationBar experience that users expect on the Insights tab.
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, DeviationBar, DeviationDonut, Card, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { resolvePortfolioDisplayName } from "@arc/core";

import {
  assetLabel,
  formatSignedPercent,
  toDeviationBarRows,
  toDonutSegments,
} from "../lib/rebalance-format";
import {
  claimInsightsSessionLiveFetch,
  insightsSessionValuationKey,
} from "../lib/insights-session-valuation";
import { isCacheFirstMarketData } from "../lib/market-data-policy";
import { useActivePortfolio, useRebalance } from "../lib/queries";

const parseCashKey = (assetId: string): string => {
  const parts = assetId.split(":");
  return parts.length >= 2 ? parts[1]! : assetId;
};

export const InsightsActiveRebalancePanel = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPulling, setIsPulling] = useState(false);

  const { portfolio, activePortfolioId, isLoading: activeLoading } = useActivePortfolio();
  const portfolioId = activePortfolioId ?? undefined;
  const reportingCurrency = portfolio?.reportingCurrency ?? "CNY";

  const { deviations, targets, holdings, isLoading, refreshFromCache, refreshFromLive } =
    useRebalance(portfolioId, reportingCurrency);

  const hasHoldings = holdings.length > 0;
  const hasTargets = targets.length > 0;

  useEffect(() => {
    if (!portfolioId || !hasHoldings || !hasTargets || !isCacheFirstMarketData()) return;
    const key = insightsSessionValuationKey(portfolioId, reportingCurrency);
    if (!claimInsightsSessionLiveFetch(key)) return;
    void refreshFromLive();
  }, [portfolioId, reportingCurrency, hasHoldings, hasTargets, refreshFromLive]);

  const handleRefresh = useCallback(async () => {
    if (!portfolioId) return;
    setIsPulling(true);
    try {
      await Promise.all([
        refreshFromCache(),
        queryClient.refetchQueries({ queryKey: ["targetAllocations", portfolioId] }),
        queryClient.refetchQueries({ queryKey: ["transactions", portfolioId] }),
      ]);
    } finally {
      setIsPulling(false);
    }
  }, [portfolioId, queryClient, refreshFromCache]);

  const labelFor = (assetId: string) =>
    assetLabel(assetId, t(`rebalance.cashNames.${parseCashKey(assetId)}` as const));

  const targetDonut = toDonutSegments(
    deviations.map((d) => ({
      assetId: d.assetId,
      label: labelFor(d.assetId),
      percent: d.targetPercent,
    }))
  );

  const currentDonut = toDonutSegments(
    deviations.map((d) => ({
      assetId: d.assetId,
      label: labelFor(d.assetId),
      percent: d.currentPercent,
    }))
  );

  const setupHref = portfolioId
    ? (`/insights/rebalance/setup?portfolioId=${portfolioId}` as Href)
    : ("/insights/rebalance/setup" as Href);
  const actionsHref = portfolioId
    ? (`/insights/rebalance/actions?portfolioId=${portfolioId}` as Href)
    : ("/insights/rebalance/actions" as Href);

  if (activeLoading || isLoading || isPulling) {
    return (
      <Card>
        <View className="p-6 items-center">
          <ActivityIndicator size="small" />
        </View>
      </Card>
    );
  }

  if (!portfolio) return null;

  const displayName = resolvePortfolioDisplayName(portfolio.name, t("portfolio.myPortfolio"));

  if (!hasHoldings) {
    return (
      <Card>
        <View className="p-4 gap-2">
          <Text className="text-foreground font-semibold">{t("rebalance.sectionTitle")}</Text>
          <Text className="text-muted text-sm">
            {t("rebalance.activePortfolioHint", { name: displayName })}
          </Text>
          <Text className="text-muted text-sm">{t("rebalance.emptyNoHoldingsHint")}</Text>
        </View>
      </Card>
    );
  }

  if (!hasTargets) {
    return (
      <Card>
        <View className="p-4 gap-3">
          <Text className="text-foreground font-semibold">{t("rebalance.sectionTitle")}</Text>
          <Text className="text-muted text-sm">
            {t("rebalance.activePortfolioHint", { name: displayName })}
          </Text>
          <Text className="text-muted text-sm">{t("rebalance.emptyTargetsDescription")}</Text>
          <Button onPress={() => router.push(setupHref)}>{t("rebalance.setupFirstCta")}</Button>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View className="p-4 gap-4">
        <View>
          <Text className="text-foreground font-semibold text-lg">
            {t("rebalance.sectionTitle")}
          </Text>
          <Text className="text-muted text-sm mt-1">
            {t("rebalance.activePortfolioHint", { name: displayName })}
          </Text>
        </View>

        <DeviationDonut targetSegments={targetDonut} currentSegments={currentDonut} />

        <DeviationBar
          rows={toDeviationBarRows(deviations, labelFor)}
          formatPercent={(v) => `${v.toFixed(1)}%`}
          formatDeviation={formatSignedPercent}
        />

        <Button onPress={() => router.push(actionsHref)}>{t("rebalance.viewActionsCta")}</Button>

        <Pressable onPress={() => void handleRefresh()}>
          <Text className="text-muted text-xs text-center">{t("common.refresh")}</Text>
        </Pressable>
      </View>
    </Card>
  );
};
