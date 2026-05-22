/**
 * TargetAllocationForm — editable target % rows + live sum indicator (J9).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import type Decimal from "decimal.js";

import { Label, Text } from "../primitives";
import { NumberField } from "../primitives-pro";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_BODY_MEDIUM, TYPO_CAPTION, TYPO_LABEL, typographyClass } from "../tokens/typography";

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

const parsePercentInput = (raw: string): number => {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return Number.NaN;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
};

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
      {rows.map((row) => {
        const numericValue = parsePercentInput(row.percentInput);
        return (
          <View
            key={row.assetId}
            className="flex-row items-center gap-3 py-2 border-b border-divider"
          >
            <View className="flex-1 min-w-0">
              <Text className={TYPO_BODY_MEDIUM}>{row.label}</Text>
              {row.subtitle ? (
                <Text className={TYPO_CAPTION} numberOfLines={1}>
                  {row.subtitle}
                </Text>
              ) : null}
            </View>
            <NumberField
              className="w-28"
              minValue={0}
              maxValue={100}
              step={0.1}
              value={numericValue}
              onChange={(v) => {
                if (Number.isNaN(v)) {
                  row.onPercentChange("");
                } else {
                  row.onPercentChange(String(v));
                }
              }}
            >
              <Label className="absolute w-px h-px opacity-0 overflow-hidden">{row.label}</Label>
              <NumberField.Group>
                <NumberField.Input className="text-right" />
              </NumberField.Group>
            </NumberField>
            <Text className={`${TYPO_LABEL} w-6`}>{percentSuffix}</Text>
          </View>
        );
      })}

      <View className="gap-1 pt-2">
        <Text className={typographyClass("title", sumColorClass)}>{sumLabel}</Text>
        {sumHint ? (
          <Text className={typographyClass("label", sumColorClass)}>{sumHint}</Text>
        ) : null}
      </View>
    </View>
  );
}
