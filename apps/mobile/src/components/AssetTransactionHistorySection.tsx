/**
 * Asset detail — per-asset transaction history list with swipe-to-delete.
 */

import type { ReactNode } from "react";
import { Alert, View } from "react-native";
import type { Transaction } from "@arc/core";
import { useTranslation } from "@arc/i18n";
import { Card, SwipeableActionsRow, Text, TYPO_CAPTION, TYPO_SECTION_TITLE } from "@arc/ui";

import { formatMoney } from "../lib/format-money";

export interface AssetTransactionHistorySectionProps {
  readonly transactions: ReadonlyArray<Transaction>;
  readonly isPending: boolean;
  readonly portfolioId: string | undefined;
  readonly amountsHidden: boolean;
  readonly onDeleteTransaction: (id: string, portfolioId: string) => void;
}

function formatTradeDate(isoDate: string): string {
  return isoDate.slice(0, 10);
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

  const sharesLine =
    tx.type === "DIVIDEND"
      ? formatMoney(tx.shares.times(tx.pricePerShare), tx.currency, { redact: amountsHidden })
      : `${tx.shares.toFixed(4)} @ ${formatMoney(tx.pricePerShare, tx.currency, { redact: amountsHidden })}`;

  const feeLine = tx.fee.isZero()
    ? null
    : formatMoney(tx.fee, tx.currency, { redact: amountsHidden });

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
        <View className="flex-row items-start justify-between gap-3 px-3 py-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-foreground text-sm font-medium">{typeLabel}</Text>
            <Text className={`${TYPO_CAPTION} text-muted`}>{formatTradeDate(tx.tradeDate)}</Text>
          </View>
          <View className="items-end gap-0.5">
            <Text className="text-foreground text-sm">{sharesLine}</Text>
            {feeLine ? (
              <Text className={`${TYPO_CAPTION} text-muted`}>
                {t("transaction.fee")}: {feeLine}
              </Text>
            ) : null}
          </View>
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
  if (transactions.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className={TYPO_SECTION_TITLE}>{t("assetDetail.transactions.sectionTitle")}</Text>
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
    </View>
  );
}
