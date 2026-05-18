/**
 * /insights/rebalance/setup — target allocation modal (J9)
 */

import { useCallback, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Decimal from "decimal.js";
import { rebalance, type TargetAllocation } from "@arc/core";
import {
  Button,
  Screen,
  TargetAllocationForm,
  type TargetSumStatus,
  Text,
  useStackScreenOptions,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { assetLabel } from "../../../src/lib/rebalance-format";
import {
  usePortfolioHoldings,
  usePortfolios,
  useUpsertTargetAllocations,
} from "../../../src/lib/queries";

const { validateTargetAllocations } = rebalance;
type TargetAllocationError = rebalance.TargetAllocationError;

const SUM_TOLERANCE = new Decimal("0.01");

const tryPercent = (raw: string): Decimal | null => {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  try {
    const d = new Decimal(trimmed);
    return d.isNaN() ? null : d;
  } catch {
    return null;
  }
};

export default function RebalanceSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { holdings } = usePortfolioHoldings(portfolioId);
  const upsert = useUpsertTargetAllocations();

  const initialPercents = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of holdings) {
      map.set(h.assetId, "");
    }
    return map;
  }, [holdings]);

  const [percents, setPercents] = useState<Map<string, string>>(initialPercents);

  const setPercent = useCallback((assetId: string, value: string) => {
    setPercents((prev) => {
      const next = new Map(prev);
      next.set(assetId, value);
      return next;
    });
  }, []);

  const targets: TargetAllocation[] = useMemo(() => {
    const rows: TargetAllocation[] = [];
    for (const h of holdings) {
      const p = tryPercent(percents.get(h.assetId) ?? "");
      if (p) rows.push({ assetId: h.assetId, targetPercent: p });
    }
    return rows;
  }, [holdings, percents]);

  const sumActual = useMemo(
    () => targets.reduce((acc, row) => acc.plus(row.targetPercent), new Decimal(0)),
    [targets]
  );

  const sumStatus: TargetSumStatus = useMemo(() => {
    if (sumActual.minus(100).abs().lte(SUM_TOLERANCE)) return "ok";
    if (sumActual.gt(100)) return "over";
    return "under";
  }, [sumActual]);

  const sumDelta = sumActual.minus(100).abs();

  const validationErrors = useMemo(() => validateTargetAllocations(targets), [targets]);

  const canSave = validationErrors.length === 0 && holdings.length > 0;

  const mapError = (err: TargetAllocationError): string => {
    switch (err.code) {
      case "empty":
        return t("rebalance.errors.empty");
      case "duplicate_asset":
        return t("rebalance.errors.duplicateAsset", { assetId: err.assetId });
      case "percent_out_of_range":
        return t("rebalance.errors.percentOutOfRange", { assetId: err.assetId });
      case "sum_not_100":
        return t("rebalance.errors.sumNot100", { actual: err.actual.toFixed(2) });
      default:
        return t("common.error");
    }
  };

  const sumLabel =
    sumStatus === "ok"
      ? t("rebalance.sumOk", { sum: sumActual.toFixed(1) })
      : t("rebalance.sumCurrent", { sum: sumActual.toFixed(1) });

  const sumHint =
    sumStatus === "under"
      ? t("rebalance.sumShort", { delta: sumDelta.toFixed(1) })
      : sumStatus === "over"
        ? t("rebalance.sumOver", { delta: sumDelta.toFixed(1) })
        : undefined;

  const handleSave = async () => {
    if (!portfolioId || !canSave) return;
    try {
      await upsert.mutateAsync({ portfolioId, targets });
      router.back();
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
    }
  };

  const screenOptions = useStackScreenOptions({
    title: t("rebalance.setupTitle"),
    backType: "close",
    headerRight: (
      <Button
        size="sm"
        variant="ghost"
        isDisabled={!canSave || upsert.isPending}
        onPress={() => void handleSave()}
      >
        {t("common.save")}
      </Button>
    ),
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        <Text className="text-muted text-sm mb-4">{t("rebalance.setupIntro")}</Text>

        <TargetAllocationForm
          rows={holdings.map((h) => ({
            assetId: h.assetId,
            label: assetLabel(
              h.assetId,
              t(`rebalance.cashNames.${h.assetId.split(":")[1]}` as "rebalance.cashNames.USD")
            ),
            percentInput: percents.get(h.assetId) ?? "",
            onPercentChange: (v) => setPercent(h.assetId, v),
          }))}
          sumActual={sumActual}
          sumStatus={sumStatus}
          sumDelta={sumDelta}
          sumLabel={sumLabel}
          sumHint={sumHint}
          percentSuffix="%"
        />

        {validationErrors.length > 0 && sumStatus !== "ok" ? (
          <View className="mt-4 gap-1">
            {validationErrors.map((err, i) => (
              <Text key={i} className="text-sm text-danger">
                {mapError(err)}
              </Text>
            ))}
          </View>
        ) : null}
      </Screen>
    </>
  );
}
