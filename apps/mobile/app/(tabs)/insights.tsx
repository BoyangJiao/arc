/**
 * (tabs)/insights.tsx — Rebalance / Insights Tab (Stage 2 J9)
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DeviationBar,
  DeviationDonut,
  EmptyState,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  Lightbulb,
  Screen,
  Text,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import {
  assetLabel,
  formatSignedPercent,
  toDeviationBarRows,
  toDonutSegments,
} from "../../src/lib/rebalance-format";
import {
  claimInsightsSessionLiveFetch,
  insightsSessionValuationKey,
} from "../../src/lib/insights-session-valuation";
import { isCacheFirstMarketData } from "../../src/lib/market-data-policy";
import { usePortfolios, useRebalance } from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";

export default function InsightsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { prefs } = useUserPreferences();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";

  const { data: portfolios, isPending: portfoliosLoading } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;

  const queryClient = useQueryClient();
  const [isPulling, setIsPulling] = useState(false);

  const { deviations, targets, holdings, isLoading, refreshValuation, refetchValuationFromCache } =
    useRebalance(portfolioId, reportingCurrency);

  const hasHoldings = holdings.length > 0;
  const hasTargets = targets.length > 0;

  useEffect(() => {
    if (!portfolioId || !hasHoldings || !hasTargets || !isCacheFirstMarketData()) return;
    const key = insightsSessionValuationKey(portfolioId, reportingCurrency);
    if (!claimInsightsSessionLiveFetch(key)) return;
    void refreshValuation();
  }, [portfolioId, reportingCurrency, hasHoldings, hasTargets, refreshValuation]);

  const handleRefresh = useCallback(async () => {
    if (!portfolioId) return;
    setIsPulling(true);
    try {
      await Promise.all([
        refetchValuationFromCache(),
        queryClient.refetchQueries({ queryKey: ["targetAllocations", portfolioId] }),
        queryClient.refetchQueries({ queryKey: ["transactions", portfolioId] }),
      ]);
    } finally {
      setIsPulling(false);
    }
  }, [portfolioId, queryClient, refetchValuationFromCache]);

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

  if (portfoliosLoading || isLoading) {
    return (
      <Screen
        scroll={false}
        contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  if (!hasHoldings) {
    return (
      <Screen
        scroll={false}
        contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}
      >
        <EmptyState className="flex-1 px-8 justify-center">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Lightbulb size={28} className="text-muted" />
            </EmptyState.Media>
            <EmptyState.Title>{t("rebalance.emptyNoHoldingsTitle")}</EmptyState.Title>
            <EmptyState.Description>{t("rebalance.emptyNoHoldingsHint")}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </Screen>
    );
  }

  if (!hasTargets) {
    return (
      <Screen
        scroll={false}
        contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}
      >
        <EmptyState className="flex-1 px-8 justify-center gap-4">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Lightbulb size={28} className="text-muted" />
            </EmptyState.Media>
            <EmptyState.Title>{t("rebalance.emptyTargetsTitle")}</EmptyState.Title>
            <EmptyState.Description>
              {t("rebalance.emptyTargetsDescription")}
            </EmptyState.Description>
          </EmptyState.Header>
          <Button onPress={() => router.push("/insights/rebalance/setup" as Href)}>
            {t("rebalance.setupFirstCta")}
          </Button>
          <Pressable onPress={() => router.push("/me/cash-balances" as Href)}>
            <Text className="text-accent text-sm text-center">
              {t("rebalance.cashBalancesLink")}
            </Text>
          </Pressable>
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={{
        padding: 24,
        gap: 20,
        paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET,
      }}
      refreshing={isPulling}
      onRefresh={() => void handleRefresh()}
    >
      <Text className="text-foreground text-xl font-bold">{t("rebalance.title")}</Text>

      <DeviationDonut targetSegments={targetDonut} currentSegments={currentDonut} />

      <DeviationBar
        rows={toDeviationBarRows(deviations, labelFor)}
        formatPercent={(v) => `${v.toFixed(1)}%`}
        formatDeviation={formatSignedPercent}
      />

      <Button onPress={() => router.push("/insights/rebalance/actions" as Href)}>
        {t("rebalance.viewActionsCta")}
      </Button>

      <Text className="text-muted text-xs text-center">{t("rebalance.disclaimer")}</Text>
    </Screen>
  );
}

const parseCashKey = (assetId: string): string => {
  const parts = assetId.split(":");
  return parts.length >= 2 ? parts[1]! : assetId;
};
