/**
 * /insights/rebalance/actions — rebalance action list (J9)
 *
 * Allocation drift (DeviationBar) → adjustments (RebalanceActionList). The drift
 * detail lives here now that the Insights dashboard card shows only the donut.
 */

import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import { parseAssetId, type Currency, type Market } from "@arc/core";
import {
  ALLOCATION_PALETTE,
  DeviationBar,
  DonutChart,
  GearIcon,
  HeaderActionButton,
  InScreenHeader,
  NAVIGATION_COLORS,
  RebalanceActionList,
  Screen,
  Text,
  TYPO_CAPTION,
  TYPO_OVERLINE,
  TYPO_ROW_TITLE,
  scrollContentBelowInScreenHeader,
  type DonutChartDatum,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useColorMode } from "../../../src/lib/theme";

import { resolveAssetLogoUrl } from "../../../src/lib/asset-logo-url";
import {
  assetLabel,
  formatSharesWithUnit,
  formatSignedPercent,
  toDeviationBarRows,
} from "../../../src/lib/rebalance-format";
import { formatMoney } from "../../../src/lib/format-money";
import { useActivePortfolio, useRebalance } from "../../../src/lib/queries";
import { useAmountRedacted } from "../../../src/lib/use-amount-redacted";
import { useUserPreferences } from "../../../src/lib/user-preferences";

const parseCashKey = (assetId: string): string => {
  const parts = assetId.split(":");
  return parts.length >= 2 ? parts[1]! : assetId;
};

export default function RebalanceActionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorMode } = useColorMode();
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";
  const { portfolioId: queryPortfolioId } = useLocalSearchParams<{ portfolioId?: string }>();
  const { activePortfolioId } = useActivePortfolio();
  const portfolioId =
    typeof queryPortfolioId === "string" && queryPortfolioId.length > 0
      ? queryPortfolioId
      : (activePortfolioId ?? undefined);

  const { deviations, targets, valuation } = useRebalance(portfolioId, reportingCurrency);

  const marketLabel = useCallback(
    (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US"),
    [t]
  );

  const labelFor = useCallback(
    (assetId: string) =>
      assetLabel(
        assetId,
        t(`rebalance.cashNames.${parseCashKey(assetId)}` as "rebalance.cashNames.USD")
      ),
    [t]
  );

  const rows = useMemo(() => {
    const valByAsset = new Map(valuation?.perAsset.map((v) => [v.assetId, v]) ?? []);

    return deviations.map((d) => {
      const val = valByAsset.get(d.assetId);
      const { market, symbol } = parseAssetId(d.assetId);
      const nativeCurrency = (val?.nativeCurrency ?? "USD") as Currency;

      const priceHint =
        market !== "CASH" && val
          ? t("rebalance.actionPriceHint", {
              price: formatMoney(val.priceNative ?? new Decimal(0), nativeCurrency, {
                redact: amountsHidden,
              }),
            })
          : "";

      return {
        assetId: d.assetId,
        label: labelFor(d.assetId),
        symbol,
        marketLabel: marketLabel(market),
        imageUrl: resolveAssetLogoUrl(market, symbol),
        sharesNeeded: d.sharesNeeded,
        amountNeeded: d.amountNeeded,
        market: market as Market,
        nativeCurrency,
        priceHint,
      };
    });
  }, [deviations, valuation, t, amountsHidden, labelFor, marketLabel]);

  const driftRows = useMemo(() => toDeviationBarRows(deviations, labelFor), [deviations, labelFor]);

  // Rebalance donut = TARGET allocation (the configured targets) — matches the
  // drift / adjustment lists below, so slice count == the rebalance config.
  const allocationDonut = useMemo<DonutChartDatum[]>(
    () =>
      targets.map((tg, i) => ({
        key: labelFor(tg.assetId),
        value: tg.targetPercent.toNumber(),
        color: ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length]!,
      })),
    [targets, labelFor]
  );

  const shareUnits = useMemo(
    () => ({ share: t("rebalance.units.share"), fund: t("rebalance.units.fund") }),
    [t]
  );

  // Donut center mirrors the dashboard card (default = max drift). Tapping a
  // slice swaps the center to that target's mix % + its drift.
  const deviationByAsset = useMemo(
    () => new Map(deviations.map((d) => [d.assetId, d.deviationPercent])),
    [deviations]
  );
  const maxDeviation = useMemo(
    () =>
      deviations.reduce(
        (max, d) => (d.deviationPercent.abs().gt(max) ? d.deviationPercent.abs() : max),
        new Decimal(0)
      ),
    [deviations]
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedTarget = selectedIndex != null ? targets[selectedIndex] : undefined;

  const donutCenter = selectedTarget ? (
    <View className="items-center px-6">
      <Text className={TYPO_ROW_TITLE} numberOfLines={1}>
        {labelFor(selectedTarget.assetId)}
      </Text>
      <Text className={`${TYPO_CAPTION} text-muted`}>
        {`${t("insights.allocation.targetLabel")} ${selectedTarget.targetPercent.toFixed(0)}%`}
      </Text>
      <Text className={`${TYPO_CAPTION} text-muted`}>
        {`${t("insights.allocation.deviationLabel")} ${formatSignedPercent(
          deviationByAsset.get(selectedTarget.assetId) ?? new Decimal(0)
        )}`}
      </Text>
    </View>
  ) : (
    <View className="items-center">
      <Text className={TYPO_ROW_TITLE}>{`${maxDeviation.toFixed(1)}%`}</Text>
      <Text className={`${TYPO_CAPTION} text-muted`}>{t("insights.allocation.maxDeviation")}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader
          title={t("rebalance.actionsTitle")}
          leftType="back"
          rightSlot={
            <HeaderActionButton
              icon={GearIcon}
              onPress={() =>
                router.push(
                  `/insights/rebalance/setup${portfolioId ? `?portfolioId=${portfolioId}` : ""}` as Href
                )
              }
              accessibilityLabel={t("rebalance.adjustTargets")}
            />
          }
        />
        <View className="gap-8 pb-10">
          {allocationDonut.length > 0 ? (
            <DonutChart
              data={allocationDonut}
              heightClass="h-56"
              insetColor={NAVIGATION_COLORS[colorMode].background}
              onSlicePress={setSelectedIndex}
              center={donutCenter}
            />
          ) : null}

          {driftRows.length > 0 ? (
            <View className="gap-4">
              <View className="gap-1">
                <Text className={TYPO_OVERLINE}>{t("rebalance.driftSectionTitle")}</Text>
                <Text className={`${TYPO_CAPTION} text-muted`}>
                  {t("rebalance.driftDirectionHint")}
                </Text>
              </View>
              <DeviationBar
                rows={driftRows}
                formatPercent={(v) => `${v.toFixed(1)}%`}
                formatDeviation={formatSignedPercent}
              />
            </View>
          ) : null}

          <View className="gap-2">
            <Text className={TYPO_OVERLINE}>{t("rebalance.actionsSectionTitle")}</Text>
            <RebalanceActionList
              rows={rows}
              formatShares={(value, market, nativeCurrency) =>
                formatSharesWithUnit(
                  value,
                  market as Market,
                  nativeCurrency as Currency,
                  shareUnits
                )
              }
              formatAmount={(amount) =>
                formatMoney(amount, reportingCurrency, { redact: amountsHidden })
              }
              amountEstimateLabel={t("rebalance.amountEstimateLabel")}
              atTargetLabel={t("rebalance.atTarget")}
              disclaimer={t("rebalance.disclaimer")}
            />
          </View>
        </View>
      </Screen>
    </>
  );
}
