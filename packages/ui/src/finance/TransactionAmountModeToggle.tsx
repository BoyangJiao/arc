/**
 * Shares vs total-amount entry toggle (ADR 016).
 */

import type { ReactNode } from "react";
import { View } from "react-native";

import { Button } from "../primitives";

export type TransactionAmountMode = "shares" | "total";

export interface TransactionAmountModeToggleProps {
  readonly mode: TransactionAmountMode;
  readonly onModeChange: (mode: TransactionAmountMode) => void;
  readonly sharesLabel: string;
  readonly totalLabel: string;
}

export function TransactionAmountModeToggle(props: TransactionAmountModeToggleProps): ReactNode {
  const { mode, onModeChange, sharesLabel, totalLabel } = props;
  return (
    <View className="flex-row gap-2">
      <Button
        variant={mode === "shares" ? "primary" : "secondary"}
        onPress={() => onModeChange("shares")}
        className="flex-1"
      >
        <Button.Label>{sharesLabel}</Button.Label>
      </Button>
      <Button
        variant={mode === "total" ? "primary" : "secondary"}
        onPress={() => onModeChange("total")}
        className="flex-1"
      >
        <Button.Label>{totalLabel}</Button.Label>
      </Button>
    </View>
  );
}
