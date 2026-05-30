/**
 * Asset detail — per-asset transaction history list (Delta / 钱往 card style).
 *
 * Each transaction renders as a card: a header row (type badge + trade date)
 * over a 2-column grid of labelled values, with an optional notes line.
 * Swipe-to-delete preserved.
 */

import type { ReactNode } from "react";
import { Alert, View } from "react-native";
import type { Transaction } from "@arc/core";
import { useTranslation } from "@arc/i18n";
import { Card, SwipeableActionsRow, Text, TYPO_CAPTION } from "@arc/ui";

import { formatMoney } from "../lib/format-money";

export interface AssetTransactionHistorySectionProps {
  readonly transactions: ReadonlyArray<Transaction>;
  readonly isPending: boolean;
  readonly portfolioId: string | undefined;
  readonly amountsHidden: boolean;
  readonly onDeleteTransaction: (id: string, portfolioId: string) => void;
}

interface GridCell {
  readonly label: string;
  readonly value: string;
}

function formatTradeDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function formatShares(tx: Transaction): string {
  return tx.shares.toDecimalPlaces(4).toString();
}

/** Build the labelled value grid per transaction type (Delta / 钱往 layout). */
function buildGridCells(
  tx: Transaction,
  amountsHidden: boolean,
  t: (key: string) => string
): GridCell[] {
  const money = (value: typeof tx.fee) =>
    formatMoney(value, tx.currency, { redact: amountsHidden });
  const cells: GridCell[] = [];

  if (tx.type === "DIVIDEND") {
    cells.push({
      label: t("assetDetail.transactions.dividendAmount"),
      value: money(tx.shares.times(tx.pricePerShare)),
    });
  } else if (tx.type === "SPLIT") {
    cells.push({ label: t("assetDetail.transactions.quantity"), value: formatShares(tx) });
  } else {
    cells.push({ label: t("assetDetail.transactions.price"), value: money(tx.pricePerShare) });
    cells.push({ label: t("assetDetail.transactions.quantity"), value: formatShares(tx) });
    cells.push({
      label: t("assetDetail.transactions.amount"),
      value: money(tx.shares.times(tx.pricePerShare)),
    });
  }

  if (!tx.fee.isZero()) {
    cells.push({ label: t("transaction.fee"), value: money(tx.fee) });
  }

  return cells;
}

function TransactionRow({
  tx,
  portfolioId,
  amountsHidden,
  onDeleteTransaction,
}: {
  tx: Transaction;
  portfolioId: string;
  amountsHidden: boolean;
  onDeleteTransaction: (id: string, portfolioId: string) => void;
}): ReactNode {
  const { t } = useTranslation();

  const typeLabel =
    tx.type === "BUY"
      ? t("transaction.buy")
      : tx.type === "SELL"
        ? t("transaction.sell")
        : tx.type === "DIVIDEND"
          ? t("transaction.dividend")
          : tx.type === "SPLIT"
            ? t("transaction.split")
            : tx.type;

  const handleDelete = () => {
    Alert.alert(
      t("assetDetail.transactions.deleteConfirmTitle"),
      t("assetDetail.transactions.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("assetDetail.transactions.deleteAction"),
          style: "destructive",
          onPress: () => onDeleteTransaction(tx.id, portfolioId),
        },
      ]
    );
  };

  const cells = buildGridCells(tx, amountsHidden, t);

  return (
    <SwipeableActionsRow
      actions={[
        {
          key: "delete",
          label: t("assetDetail.transactions.deleteAction"),
          destructive: true,
          onPress: handleDelete,
        },
      ]}
    >
      <Card>
        <View className="gap-3 px-3 py-3">
          {/* Header: type badge + trade date */}
          <View className="flex-row items-center gap-2">
            <View className="bg-surface-secondary rounded-md px-2 py-0.5">
              <Text className="text-foreground text-xs font-medium">{typeLabel}</Text>
            </View>
            <Text className={`${TYPO_CAPTION} text-muted`}>{formatTradeDate(tx.tradeDate)}</Text>
          </View>

          {/* Value grid — 2 columns */}
          <View className="flex-row flex-wrap">
            {cells.map((cell) => (
              <View key={cell.label} className="w-1/2 gap-0.5 py-1.5 pr-3">
                <Text className={`${TYPO_CAPTION} text-muted`}>{cell.label}</Text>
                <Text className="text-foreground text-sm">{cell.value}</Text>
              </View>
            ))}
          </View>

          {/* Notes (display-only) */}
          {tx.notes ? (
            <View className="gap-0.5">
              <Text className={`${TYPO_CAPTION} text-muted`}>
                {t("assetDetail.transactions.notes")}
              </Text>
              <Text className="text-foreground text-sm">{tx.notes}</Text>
            </View>
          ) : null}
        </View>
      </Card>
    </SwipeableActionsRow>
  );
}

export function AssetTransactionHistorySection({
  transactions,
  isPending,
  portfolioId,
  amountsHidden,
  onDeleteTransaction,
}: AssetTransactionHistorySectionProps): ReactNode {
  const { t } = useTranslation();

  if (isPending || !portfolioId) return null;

  if (transactions.length === 0) {
    return (
      <View className="py-8">
        <Text className={`${TYPO_CAPTION} text-muted text-center`}>
          {t("assetDetail.transactions.empty")}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {transactions.map((tx) => (
        <TransactionRow
          key={tx.id}
          tx={tx}
          portfolioId={portfolioId}
          amountsHidden={amountsHidden}
          onDeleteTransaction={onDeleteTransaction}
        />
      ))}
    </View>
  );
}
