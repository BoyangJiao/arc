/**
 * portfolio/[id]/daily-snapshot.tsx — Daily P&L detail
 */

import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import {
  DailySnapshotDetailView,
  InScreenHeader,
  Screen,
  Text,
  TYPO_LABEL,
  formatCompactChangeLine,
  formatSignedPercent,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { parseAssetId } from "@arc/core";
import Decimal from "decimal.js";

import { currencySymbol, formatMoney } from "../../../src/lib/format-money";
import {
  isMarketFilterActive,
  parseMarketFiltersParam,
} from "../../../src/lib/portfolio-market-filter";
import { useDailyDelta, usePortfolio } from "../../../src/lib/queries";
import { useAmountRedacted } from "../../../src/lib/use-amount-redacted";
import { useUserPreferences } from "../../../src/lib/user-preferences";

const MS_PER_DAY = 86_400_000;

const staleBaselineDayCount = (baselineAsOf: string): number => {
  const elapsed = Date.now() - new Date(baselineAsOf).getTime();
  return Math.max(1, Math.floor(elapsed / MS_PER_DAY));
};

export default function DailySnapshotDetailScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const { id: portfolioId, markets: marketsParam } = useLocalSearchParams<{
    id: string;
    markets?: string;
  }>();
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const { data: portfolio } = usePortfolio(portfolioId);

  const marketFilters = useMemo(() => parseMarketFiltersParam(marketsParam), [marketsParam]);
  const marketFilterActive = isMarketFilterActive(marketFilters);

  const reportingCurrency = portfolio?.reportingCurrency ?? prefs?.reportingCurrency ?? "CNY";
  const {
    data: delta,
    isPending,
    isError,
  } = useDailyDelta(portfolioId, reportingCurrency, marketFilterActive ? marketFilters : undefined);

  const formatFooterDate = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(i18n.language.startsWith("zh") ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(iso)),
    [i18n.language]
  );

  const staleBaselineLabel = useMemo(() => {
    if (delta?.status !== "ok" || !delta.baselineAsOf) return undefined;
    const days = staleBaselineDayCount(delta.baselineAsOf);
    if (days <= 1) return undefined;
    return t("dailySnapshot.staleBaseline", { days });
  }, [delta, t]);

  const formatMoverAmount = useCallback(
    (amount: Decimal) => formatMoney(amount, reportingCurrency, { redact: amountsHidden }),
    [reportingCurrency, amountsHidden]
  );

  const handleMoverPress = useCallback(
    (assetId: string) => {
      const { market, symbol } = parseAssetId(assetId);
      if (market === "CASH") return;
      router.push(`/asset/${market}/${symbol}` as Href);
    },
    [router]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader title={t("dailySnapshot.detailTitle")} leftType="back" />
        <View className="gap-4 px-4 pb-8">
          {isPending ? (
            <Text className={TYPO_LABEL}>{t("common.loading")}</Text>
          ) : isError || !delta ? (
            <Text className={TYPO_LABEL}>{t("common.error")}</Text>
          ) : (
            <DailySnapshotDetailView
              delta={delta}
              title={t("dailySnapshot.title")}
              noBaselineMessage={t("dailySnapshot.noBaseline")}
              allNewPositionsMessage={t("dailySnapshot.allNewPositions")}
              moversSectionTitle={t("dailySnapshot.moversSection")}
              disclaimer={t("dailySnapshot.disclaimer")}
              formatChangeLine={(d, p) =>
                formatCompactChangeLine(d, p, currencySymbol(reportingCurrency), {
                  redactAmount: amountsHidden,
                })
              }
              formatAmount={formatMoverAmount}
              formatPercent={formatSignedPercent}
              formatAssetLabel={(assetId) => parseAssetId(assetId).symbol}
              formatFooterDate={formatFooterDate}
              staleBaselineLabel={staleBaselineLabel}
              onMoverPress={handleMoverPress}
            />
          )}
        </View>
      </Screen>
    </>
  );
}
