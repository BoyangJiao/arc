/**
 * CashBalanceTransferDialog — cross-portfolio cash transfer (modal open snapshot balance).
 */

import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import Decimal from "decimal.js";
import { CashBalanceTransferSheet } from "@arc/ui";
import type { Currency, TransferIntent } from "@arc/core";
import { useTranslation } from "@arc/i18n";

import { formatMoney } from "../lib/format-money";
import { useAmountRedacted } from "../lib/use-amount-redacted";
import {
  TransferValidationError,
  useCashBalances,
  usePortfolios,
  useTransferBetweenPortfolios,
  type CashAssetId,
} from "../lib/queries";

const tryAmount = (raw: string): Decimal | null => {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  try {
    const d = new Decimal(trimmed);
    return d.isNaN() || !d.gt(0) ? null : d;
  } catch {
    return null;
  }
};

export interface CashBalanceTransferDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly sourcePortfolioId: string;
  readonly sourcePortfolioName: string;
}

export const CashBalanceTransferDialog = ({
  open,
  onOpenChange,
  sourcePortfolioId,
  sourcePortfolioName,
}: CashBalanceTransferDialogProps) => {
  const { t } = useTranslation();
  const { amountsHidden } = useAmountRedacted();
  const { data: portfolios = [] } = usePortfolios();
  const { rows } = useCashBalances(sourcePortfolioId);
  const transfer = useTransferBetweenPortfolios();

  const [destId, setDestId] = useState<string | null>(null);
  const [currencyAssetId, setCurrencyAssetId] = useState<CashAssetId | null>(null);
  const [amount, setAmount] = useState("");
  const [snapshotBalances, setSnapshotBalances] = useState<Map<string, Decimal>>(new Map());

  useEffect(() => {
    if (!open) return;
    setSnapshotBalances(new Map(rows.map((r) => [r.assetId, r.balance])));
    const withBalance = rows.filter((r) => r.balance.gt(0));
    setCurrencyAssetId(withBalance[0]?.assetId ?? null);
    const dest = portfolios.find((p) => p.id !== sourcePortfolioId);
    setDestId(dest?.id ?? null);
    setAmount("");
  }, [open, rows, portfolios, sourcePortfolioId]);

  const destOptions = useMemo(
    () =>
      portfolios
        .filter((p) => p.id !== sourcePortfolioId && p.archivedAt === null)
        .map((p) => ({ id: p.id, label: p.name })),
    [portfolios, sourcePortfolioId]
  );

  const currencyOptions = useMemo(() => {
    return rows
      .filter((r) => {
        const snap = snapshotBalances.get(r.assetId) ?? r.balance;
        return snap.gt(0);
      })
      .map((r) => {
        const snap = snapshotBalances.get(r.assetId) ?? r.balance;
        return {
          assetId: r.assetId,
          currency: r.currency,
          balanceLabel: formatMoney(snap, r.currency, { redact: amountsHidden }),
        };
      });
  }, [rows, snapshotBalances, amountsHidden]);

  const snapshotBalance = currencyAssetId
    ? (snapshotBalances.get(currencyAssetId) ?? new Decimal(0))
    : new Decimal(0);

  const parsedAmount = tryAmount(amount);
  const amountError =
    parsedAmount && parsedAmount.gt(snapshotBalance)
      ? t("portfolios.transferExceedsBalance", {
          assetId: currencyAssetId ?? "",
          balance: snapshotBalance.toFixed(2),
        })
      : null;

  const canSubmit =
    !!destId &&
    !!currencyAssetId &&
    !!parsedAmount &&
    !amountError &&
    parsedAmount.lte(snapshotBalance);

  const handleConfirm = async () => {
    if (!destId || !currencyAssetId || !parsedAmount) return;

    const intent: TransferIntent = {
      sourcePortfolioId,
      destPortfolioId: destId,
      assetId: currencyAssetId as `CASH:${Currency}`,
      amount: parsedAmount,
    };

    try {
      await transfer.mutateAsync(intent);
      const destName = portfolios.find((p) => p.id === destId)?.name ?? "";
      Alert.alert(
        t("common.save"),
        t("portfolios.transferSuccess", {
          amount: parsedAmount.toString(),
          currency: currencyAssetId.replace("CASH:", ""),
          dest: destName,
        })
      );
      onOpenChange(false);
    } catch (err) {
      if (err instanceof TransferValidationError) {
        const exceed = err.errors.find((e) => e.code === "amount_exceeds_balance");
        if (exceed?.code === "amount_exceeds_balance") {
          Alert.alert(
            t("common.error"),
            t("portfolios.transferExceedsBalance", {
              assetId: currencyAssetId,
              balance: exceed.balance.toFixed(2),
            })
          );
          return;
        }
      }
      Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <CashBalanceTransferSheet
      open={open}
      onOpenChange={onOpenChange}
      sourceFieldLabel={t("portfolios.transferFrom")}
      sourcePortfolioName={sourcePortfolioName}
      destOptions={destOptions}
      destId={destId}
      onDestChange={setDestId}
      currencyOptions={currencyOptions}
      currencyAssetId={currencyAssetId}
      onCurrencyChange={(id) => setCurrencyAssetId(id as CashAssetId)}
      amount={amount}
      onAmountChange={setAmount}
      availableLabel={t("portfolios.transferAvailable", {
        amount: currencyAssetId
          ? formatMoney(snapshotBalance, currencyAssetId.replace("CASH:", "") as Currency, {
              redact: amountsHidden,
            })
          : "—",
      })}
      noFxHint={t("portfolios.transferNoFx")}
      amountError={amountError}
      title={t("portfolios.transferTitle")}
      destLabel={t("portfolios.transferTo")}
      currencyLabel={t("portfolios.transferCurrency")}
      amountLabel={t("portfolios.transferAmount")}
      confirmLabel={t("portfolios.transferConfirm")}
      cancelLabel={t("common.cancel")}
      canSubmit={canSubmit}
      isPending={transfer.isPending}
      onConfirm={() => void handleConfirm()}
    />
  );
};
