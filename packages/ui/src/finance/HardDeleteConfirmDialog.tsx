/**
 * HardDeleteConfirmDialog — type portfolio name to confirm permanent delete.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Dialog, Input, Label, Text, TextField } from "../primitives";
import { TYPO_LABEL } from "../tokens/typography";

export interface HardDeleteConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly portfolioName: string;
  readonly transactionCount: number;
  readonly confirmValue: string;
  readonly onConfirmValueChange: (value: string) => void;
  readonly onConfirm: () => void;
  readonly isPending?: boolean;
  readonly title: string;
  readonly description: string;
  readonly inputLabel: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

export function HardDeleteConfirmDialog({
  open,
  onOpenChange,
  portfolioName,
  transactionCount: _transactionCount,
  confirmValue,
  onConfirmValueChange,
  onConfirm,
  isPending = false,
  title,
  description,
  inputLabel,
  confirmLabel,
  cancelLabel,
}: HardDeleteConfirmDialogProps): ReactNode {
  const nameMatches = confirmValue.trim() === portfolioName;
  const canDelete = nameMatches && !isPending;

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>
            <Text className={TYPO_LABEL}>{description}</Text>
          </Dialog.Description>
          <View className="gap-3 mt-4">
            <TextField>
              <Label>{inputLabel}</Label>
              <Input
                value={confirmValue}
                onChangeText={onConfirmValueChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField>
            <View className="flex-row gap-2 justify-end">
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                <Button.Label>{cancelLabel}</Button.Label>
              </Button>
              <Button
                variant="danger"
                isDisabled={!canDelete}
                onPress={() => {
                  if (!canDelete) return;
                  onConfirm();
                }}
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
