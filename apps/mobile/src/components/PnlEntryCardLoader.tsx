/**
 * PnlEntryCardLoader — 盈亏分析 entry on the Insights tab.
 *
 * Reuses the 累计盈亏 card visual (PnlCumulativeCard) as the outer entry, titled
 * 盈亏分析, tapping through to the full /insights/pnl-analysis detail. Data is the
 * active portfolio's range-independent cumulative summary (same as the detail).
 */

import type { ReactNode } from "react";
import { useRouter, type Href } from "expo-router";
import type Decimal from "decimal.js";
import { PnlCumulativeCard, formatSignedPercent, type PnlSign } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { buildCumulativePnlSummary } from "../lib/pnl-presenter";
import { formatMoney } from "../lib/format-money";
import { useActivePortfolio, usePortfolioHoldings, usePortfolioValuation } from "../lib/queries";
import { useAmountRedacted } from "../lib/use-amount-redacted";
import { useUserPreferences } from "../lib/user-preferences";

const signOf = (value: Decimal | null | undefined): PnlSign =>
  !value || value.isZero() ? "neutral" : value.isNegative() ? "loss" : "gain";

export const PnlEntryCardLoader = (): ReactNode => {
  const { t } = useTranslation();
  const router = useRouter();
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";

  const { activePortfolioId } = useActivePortfolio();
  const portfolioId = activePortfolioId ?? undefined;

  const { data: valuation } = usePortfolioValuation(portfolioId, reportingCurrency);
  const { holdings } = usePortfolioHoldings(portfolioId);

  const cumulative = valuation ? buildCumulativePnlSummary(valuation, holdings) : null;
  const money = (amount: Decimal): string =>
    formatMoney(amount, reportingCurrency, { redact: amountsHidden });

  return (
    <PnlCumulativeCard
      sectionTitle={t("insights.pnl.entryCardTitle")}
      onPress={() => router.push("/insights/pnl-analysis" as Href)}
      accessibilityLabel={t("insights.pnl.entryCardTitle")}
      holdingReturnLabelText={t("insights.pnl.cumulative.holdingReturn")}
      holdingReturnLabel={cumulative ? money(cumulative.holdingReturn) : "—"}
      holdingReturnPercentLabel={
        cumulative?.holdingReturnPercent
          ? formatSignedPercent(cumulative.holdingReturnPercent)
          : undefined
      }
      holdingReturnSign={signOf(cumulative?.holdingReturn)}
      totalInvestedLabelText={t("insights.pnl.cumulative.totalInvested")}
      totalInvestedValue={cumulative ? money(cumulative.totalInvested) : "—"}
      totalValueLabelText={t("insights.pnl.cumulative.totalValue")}
      totalValueValue={cumulative ? money(cumulative.totalValue) : "—"}
    />
  );
};
