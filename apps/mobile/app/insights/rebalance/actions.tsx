/**
 * /insights/rebalance/actions — rebalance action list (J9)
 */

import { useMemo } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import Decimal from "decimal.js";
import { parseAssetId, type Currency, type Market } from "@arc/core";
import {
  InScreenHeader,
  RebalanceActionList,
  Screen,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { assetLabel, formatSharesWithUnit } from "../../../src/lib/rebalance-format";
import { formatMoney } from "../../../src/lib/format-money";
import { useActivePortfolio, useRebalance } from "../../../src/lib/queries";
import { useAmountRedacted } from "../../../src/lib/use-amount-redacted";
import { useUserPreferences } from "../../../src/lib/user-preferences";

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

  const rows = useMemo(() => {
    const valByAsset = new Map(valuation?.perAsset.map((v) => [v.assetId, v]) ?? []);

    return deviations.map((d) => {
      const val = valByAsset.get(d.assetId);
      const { market } = parseAssetId(d.assetId);
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
        label: assetLabel(
          d.assetId,
          t(`rebalance.cashNames.${nativeCurrency}` as "rebalance.cashNames.USD")
        ),
        sharesNeeded: d.sharesNeeded,
        amountNeeded: d.amountNeeded,
        market: market as Market,
        nativeCurrency,
        priceHint,
      };
    });
  }, [deviations, valuation, t, amountsHidden]);

  const shareUnits = useMemo(
    () => ({ share: t("rebalance.units.share"), fund: t("rebalance.units.fund") }),
    [t]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader title={t("rebalance.actionsTitle")} leftType="back" />
        <RebalanceActionList
          rows={rows}
          formatShares={(value, market, nativeCurrency) =>
            formatSharesWithUnit(value, market as Market, nativeCurrency as Currency, shareUnits)
          }
          formatAmount={(amount) =>
            formatMoney(amount, reportingCurrency, { redact: amountsHidden })
          }
          amountEstimateLabel={t("rebalance.amountEstimateLabel")}
          atTargetLabel={t("rebalance.atTarget")}
          disclaimer={t("rebalance.disclaimer")}
        />
      </Screen>
    </>
  );
}
