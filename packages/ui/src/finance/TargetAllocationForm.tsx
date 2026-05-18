/**
 * TargetAllocationForm — editable target % rows + live sum indicator (J9).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Input, Text, TextField } from "../primitives";
import { useBusinessClasses } from "../tokens/business-context";

export interface TargetAllocationFormRow {
  readonly assetId: string;
  readonly label: string;
  readonly subtitle?: string;
  readonly percentInput: string;
  readonly onPercentChange: (value: string) => void;
}

export type TargetSumStatus = "under" | "over" | "ok";

export interface TargetAllocationFormProps {
  readonly rows: ReadonlyArray<TargetAllocationFormRow>;
  readonly sumActual: Decimal;
  readonly sumStatus: TargetSumStatus;
  readonly sumDelta: Decimal;
  readonly sumLabel: string;
  readonly sumHint?: string;
  readonly percentSuffix: string;
}

export function TargetAllocationForm({
  rows,
  sumLabel,
  sumHint,
  sumStatus,
  percentSuffix,
}: TargetAllocationFormProps): ReactNode {
  const classes = useBusinessClasses();
  const sumColorClass =
    sumStatus === "ok"
      ? classes.pnlNeutral.text
      : sumStatus === "over"
        ? classes.deviationCritical.textOnSoft
        : classes.deviationWarning.textOnSoft;

  return (
    <View className="gap-4">
      {rows.map((row) => (
        <View
          key={row.assetId}
          className="flex-row items-center gap-3 py-2 border-b border-divider"
        >
          <View className="flex-1 min-w-0">
            <Text className="text-foreground text-base font-medium">{row.label}</Text>
            {row.subtitle ? (
              <Text className="text-muted text-xs" numberOfLines={1}>
                {row.subtitle}
              </Text>
            ) : null}
          </View>
          <TextField className="w-24" aria-label={row.label}>
            <Input
              value={row.percentInput}
              onChangeText={row.onPercentChange}
              keyboardType="decimal-pad"
              className="text-right"
            />
          </TextField>
          <Text className="text-muted text-sm w-6">{percentSuffix}</Text>
        </View>
      ))}

      <View className="gap-1 pt-2">
        <Text className={`text-base font-semibold ${sumColorClass}`}>{sumLabel}</Text>
        {sumHint ? <Text className={`text-sm ${sumColorClass}`}>{sumHint}</Text> : null}
      </View>
    </View>
  );
}
