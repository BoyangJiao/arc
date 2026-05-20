/**
 * CashBalanceTransferSheet — cross-portfolio cash transfer form (presentational).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Dialog, Input, Text, TextField } from "../primitives";

export interface TransferDestOption {
  readonly id: string;
  readonly label: string;
}

export interface TransferCurrencyOption {
  readonly assetId: string;
  readonly currency: string;
  readonly balanceLabel: string;
}

export interface CashBalanceTransferSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly sourceFieldLabel: string;
  readonly sourcePortfolioName: string;
  readonly destOptions: ReadonlyArray<TransferDestOption>;
  readonly destId: string | null;
  readonly onDestChange: (id: string) => void;
  readonly currencyOptions: ReadonlyArray<TransferCurrencyOption>;
  readonly currencyAssetId: string | null;
  readonly onCurrencyChange: (assetId: string) => void;
  readonly amount: string;
  readonly onAmountChange: (value: string) => void;
  readonly availableLabel: string;
  readonly noFxHint: string;
  readonly amountError: string | null;
  readonly title: string;
  readonly destLabel: string;
  readonly currencyLabel: string;
  readonly amountLabel: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly canSubmit: boolean;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
}

export function CashBalanceTransferSheet({
  open,
  onOpenChange,
  sourceFieldLabel,
  sourcePortfolioName,
  destOptions,
  destId,
  onDestChange,
  currencyOptions,
  currencyAssetId,
  onCurrencyChange,
  amount,
  onAmountChange,
  availableLabel,
  noFxHint,
  amountError,
  title,
  destLabel,
  currencyLabel,
  amountLabel,
  confirmLabel,
  cancelLabel,
  canSubmit,
  isPending,
  onConfirm,
}: CashBalanceTransferSheetProps): ReactNode {
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-h-[85%]">
          <Dialog.Title>{title}</Dialog.Title>
          <View className="gap-4 mt-2">
            <View>
              <Text className="text-muted text-xs mb-1">{sourceFieldLabel}</Text>
              <Text className="text-foreground font-medium">{sourcePortfolioName}</Text>
            </View>

            <View className="gap-2">
              <Text className="text-muted text-xs">{destLabel}</Text>
              {destOptions.map((opt) => (
                <Button
                  key={opt.id}
                  variant={destId === opt.id ? "secondary" : "ghost"}
                  onPress={() => onDestChange(opt.id)}
                >
                  <Button.Label>{opt.label}</Button.Label>
                </Button>
              ))}
            </View>

            <View className="gap-2">
              <Text className="text-muted text-xs">{currencyLabel}</Text>
              {currencyOptions.map((opt) => (
                <Button
                  key={opt.assetId}
                  variant={currencyAssetId === opt.assetId ? "secondary" : "ghost"}
                  onPress={() => onCurrencyChange(opt.assetId)}
                >
                  <Button.Label>
                    {opt.currency} — {opt.balanceLabel}
                  </Button.Label>
                </Button>
              ))}
            </View>

            <TextField>
              <Text className="text-muted text-xs mb-1">{amountLabel}</Text>
              <Input
                value={amount}
                onChangeText={onAmountChange}
                keyboardType="decimal-pad"
                className="text-right"
              />
            </TextField>
            <Text className="text-muted text-xs">{availableLabel}</Text>
            {amountError ? <Text className="text-danger text-xs">{amountError}</Text> : null}
            <Text className="text-muted text-xs">{noFxHint}</Text>

            <View className="flex-row gap-2 justify-end">
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                <Button.Label>{cancelLabel}</Button.Label>
              </Button>
              <Button
                variant="primary"
                isDisabled={!canSubmit || isPending}
                onPress={() => void onConfirm()}
              >
                <Button.Label>{confirmLabel}</Button.Label>
              </Button>
            </View>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
