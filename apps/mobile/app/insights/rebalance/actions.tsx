/**
 * /insights/rebalance/actions — rebalance action list (J9)
 */

import { useMemo } from "react";
import { Stack } from "expo-router";
import Decimal from "decimal.js";
import { parseAssetId } from "@arc/core";
import { RebalanceActionList, Screen, useStackScreenOptions } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import {
  assetLabel,
  formatSharesDelta,
  shareDecimalsForMarket,
} from "../../../src/lib/rebalance-format";
import { currencySymbol, formatMoney } from "../../../src/lib/format-money";
import { usePortfolios, useRebalance } from "../../../src/lib/queries";
import { useUserPreferences } from "../../../src/lib/user-preferences";

export default function RebalanceActionsScreen() {
  const { t } = useTranslation();
  const { prefs } = useUserPreferences();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;

  const { deviations, valuation } = useRebalance(portfolioId, reportingCurrency);

  const rows = useMemo(() => {
    const valByAsset = new Map(valuation?.perAsset.map((v) => [v.assetId, v]) ?? []);

    return deviations.map((d) => {
      const val = valByAsset.get(d.assetId);
      const { market } = parseAssetId(d.assetId);
      const nativeCurrency = val?.nativeCurrency ?? "USD";
      const priceNative = val?.priceNative ?? new Decimal(0);

      const priceHint = val
        ? t("rebalance.actionPriceHint", {
            price: `${currencySymbol(nativeCurrency)}${priceNative.toFixed(2)}`,
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
        priceHint,
        shareDecimals: shareDecimalsForMarket(market, nativeCurrency),
      };
    });
  }, [deviations, valuation, t]);

  const screenOptions = useStackScreenOptions({
    title: t("rebalance.actionsTitle"),
    backType: "chevron",
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        <RebalanceActionList
          rows={rows}
          formatShares={formatSharesDelta}
          formatAmount={(amount) => formatMoney(amount, reportingCurrency)}
          sharesChangeLabel={t("rebalance.sharesChangeLabel")}
          amountEstimateLabel={t("rebalance.amountEstimateLabel")}
          atTargetLabel={t("rebalance.atTarget")}
          disclaimer={t("rebalance.disclaimer")}
        />
      </Screen>
    </>
  );
}
