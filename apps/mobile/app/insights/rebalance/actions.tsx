/**
 * /insights/rebalance/actions — rebalance action list (J9)
 *
 * Allocation drift (DeviationBar) → adjustments (RebalanceActionList). The drift
 * detail lives here now that the Insights dashboard card shows only the donut.
 */

import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import Decimal from "decimal.js";
import { parseAssetId, type Currency, type Market } from "@arc/core";
import {
  Card,
  DeviationBar,
  InScreenHeader,
  RebalanceActionList,
  Screen,
  Text,
  TYPO_OVERLINE,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

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
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";
  const { portfolioId: queryPortfolioId } = useLocalSearchParams<{ portfolioId?: string }>();
  const { activePortfolioId } = useActivePortfolio();
  const portfolioId =
    typeof queryPortfolioId === "string" && queryPortfolioId.length > 0
      ? queryPortfolioId
      : (activePortfolioId ?? undefined);

  const { deviations, valuation } = useRebalance(portfolioId, reportingCurrency);

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

  const shareUnits = useMemo(
    () => ({ share: t("rebalance.units.share"), fund: t("rebalance.units.fund") }),
    [t]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader title={t("rebalance.actionsTitle")} leftType="back" />
        <View className="px-4 gap-4 pb-10">
          {driftRows.length > 0 ? (
            <Card>
              <View className="p-5 gap-4">
                <Text className={TYPO_OVERLINE}>{t("rebalance.driftSectionTitle")}</Text>
                <DeviationBar
                  rows={driftRows}
                  formatPercent={(v) => `${v.toFixed(1)}%`}
                  formatDeviation={formatSignedPercent}
                />
              </View>
            </Card>
          ) : null}

          <Card>
            <View className="p-5 gap-2">
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
          </Card>
        </View>
      </Screen>
    </>
  );
}
