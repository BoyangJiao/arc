/**
 * OPENING_SNAPSHOT entry — shares + total invested (ADR 016).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import {
  Button,
  Description,
  FieldError,
  InScreenHeader,
  Input,
  Label,
  Screen,
  Text,
  TextField,
  TransactionAmountModeToggle,
  type TransactionAmountMode,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { composeAssetId, type Currency, type Market } from "@arc/core";
import type { SymbolSearchResult } from "@arc/data-sources";

import { MarketSelector } from "../../../../../src/components/MarketSelector";
import { SymbolPicker } from "../../../../../src/components/SymbolPicker";
import {
  useCreateTransaction,
  type CreateTransactionAssetMeta,
} from "../../../../../src/lib/queries";
import {
  getLastUsedMarket,
  setLastUsedMarket,
} from "../../../../../src/lib/store/last-used-market";
import {
  resolveSharesAndUnitPrice,
  type AmountEntryMode,
} from "../../../../../src/lib/transaction-form-presenter";

const defaultCurrencyForMarket = (market: Market): Currency => {
  switch (market) {
    case "CN":
    case "FUND":
      return "CNY";
    case "HK":
      return "HKD";
    case "US":
    case "CRYPTO":
      return "USD";
    case "CASH":
      return "USD";
    default: {
      const _exhaustive: never = market;
      return _exhaustive;
    }
  }
};

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

interface FormErrors {
  amount?: string;
  unitPrice?: string;
  tradeDate?: string;
}

function tryDecimal(raw: string): Decimal | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  try {
    const d = new Decimal(trimmed);
    return d.isNaN() ? null : d;
  } catch {
    return null;
  }
}

export default function OpeningSnapshotEntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    id: portfolioId,
    prefillMarket,
    prefillSymbol,
  } = useLocalSearchParams<{
    id: string;
    prefillMarket?: string;
    prefillSymbol?: string;
  }>();

  const createTransaction = useCreateTransaction();

  const [step, setStep] = useState<1 | 2>(() => (prefillMarket && prefillSymbol ? 2 : 1));
  const [market, setMarket] = useState<Market>("US");
  const [selected, setSelected] = useState<SymbolSearchResult | null>(() =>
    prefillMarket && prefillSymbol
      ? {
          assetId: composeAssetId(prefillMarket as Market, prefillSymbol),
          market: prefillMarket as Market,
          symbol: prefillSymbol,
          name: prefillSymbol,
          currency: defaultCurrencyForMarket(prefillMarket as Market),
        }
      : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [amountMode, setAmountMode] = useState<AmountEntryMode>("total");
  const [shares, setShares] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [tradeDate, setTradeDate] = useState(todayIsoDate);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!portfolioId) return;
    void getLastUsedMarket(portfolioId).then((m) => {
      if (m && !prefillMarket) setMarket(m);
    });
  }, [portfolioId, prefillMarket]);

  const currency = useMemo(
    () => selected?.currency ?? defaultCurrencyForMarket(market),
    [selected, market]
  );

  const marketLabel = useCallback(
    (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US"),
    [t]
  );

  const handleMarketChange = (m: Market) => {
    setMarket(m);
    setSelected(null);
    setSearchQuery("");
    if (portfolioId) void setLastUsedMarket(portfolioId, m);
  };

  const handleSelectSymbol = (row: SymbolSearchResult) => {
    setSelected(row);
    setStep(2);
  };

  const validateStep2 = (): boolean => {
    const next: FormErrors = {};
    const unitD = tryDecimal(unitPrice);
    if (!unitD || unitD.lte(0)) next.unitPrice = t("transaction.invalidNumber");
    const resolved = resolveSharesAndUnitPrice(
      amountMode,
      tryDecimal(shares),
      unitD,
      tryDecimal(totalAmount)
    );
    if (!resolved) next.amount = t("transaction.invalidNumber");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate.trim())) {
      next.tradeDate = t("transaction.invalidDate");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const resolveCreateError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("SYMBOL_NOT_FOUND:")) {
      const sym = msg.slice("SYMBOL_NOT_FOUND:".length);
      return t("transaction.symbolNotFound", { symbol: sym });
    }
    if (msg === "SYMBOL_RATE_LIMITED") {
      return t("transaction.symbolRateLimited");
    }
    return msg.length > 0 ? msg : t("common.error");
  };

  const handleSubmit = async () => {
    if (!portfolioId || !selected) return;
    if (!validateStep2()) return;

    const unitD = tryDecimal(unitPrice)!;
    const resolved = resolveSharesAndUnitPrice(
      amountMode,
      tryDecimal(shares),
      unitD,
      tryDecimal(totalAmount)
    )!;
    const assetMeta: CreateTransactionAssetMeta = {
      market: selected.market,
      symbol: selected.symbol,
      name: selected.name,
      currency: selected.currency,
    };

    try {
      await createTransaction.mutateAsync({
        portfolioId,
        assetId: selected.assetId,
        type: "OPENING_SNAPSHOT",
        shares: resolved.shares.toString(),
        pricePerShare: resolved.pricePerShare.toString(),
        currency: selected.currency,
        fee: "0",
        tradeDate: new Date(`${tradeDate}T12:00:00.000Z`).toISOString(),
        assetMeta,
      });
      setSubmitSuccess(true);
    } catch {
      /* surfaced below */
    }
  };

  const isSubmitting = createTransaction.isPending;

  if (submitSuccess) {
    return (
      <Screen edges={["bottom"]}>
        <InScreenHeader title={t("transaction.entry.modeD.label")} leftType="close" />
        <View className="gap-4 items-center py-8">
          <Text className="text-foreground text-center">{t("transaction.success")}</Text>
          <Button variant="secondary" onPress={() => router.replace("/(tabs)" as Href)}>
            <Button.Label>{t("transaction.doneBackToPortfolio")}</Button.Label>
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={step !== 1} edges={["bottom"]}>
      <InScreenHeader title={t("transaction.entry.modeD.label")} leftType="close" />
      <View className={step === 1 ? "flex-1 gap-4" : "gap-4"}>
        {step === 1 ? (
          <>
            <MarketSelector value={market} onChange={handleMarketChange} labelFor={marketLabel} />
            <SymbolPicker
              market={market}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSelect={handleSelectSymbol}
              placeholder={t("transaction.assetSearchCrossMarket")}
              emptyHint={t("transaction.searchMinChars")}
              searchUnavailable={t("transaction.searchUnavailable")}
              searchNoResults={t("transaction.searchNoResults")}
              searchNotConfigured={t("transaction.searchNotConfigured")}
            />
          </>
        ) : (
          <>
            {selected ? (
              <Text className="text-foreground font-medium">
                {selected.name} ({selected.assetId})
              </Text>
            ) : null}
            <TransactionAmountModeToggle
              mode={amountMode as TransactionAmountMode}
              onModeChange={setAmountMode}
              sharesLabel={t("transaction.amount.toggle.shares")}
              totalLabel={t("transaction.amount.toggle.total")}
            />
            {amountMode === "shares" ? (
              <TextField isRequired isInvalid={!!errors.amount}>
                <Label>{t("transaction.shares")}</Label>
                <Input
                  value={shares}
                  onChangeText={setShares}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
              </TextField>
            ) : (
              <TextField isRequired isInvalid={!!errors.amount}>
                <Label>
                  {t("transaction.amount.toggle.total")} ({currency})
                </Label>
                <Input
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
              </TextField>
            )}
            <TextField isRequired isInvalid={!!errors.unitPrice}>
              <Label>{t("transaction.snapshot.unitPrice.label")}</Label>
              <Input
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="decimal-pad"
                editable={!isSubmitting}
              />
              <Description>{t("transaction.snapshot.unitPrice.hint")}</Description>
              {errors.unitPrice ? <FieldError>{errors.unitPrice}</FieldError> : null}
            </TextField>
            <TextField isRequired isInvalid={!!errors.tradeDate}>
              <Label>{t("transaction.date")}</Label>
              <Input
                value={tradeDate}
                onChangeText={setTradeDate}
                placeholder="YYYY-MM-DD"
                editable={!isSubmitting}
              />
              <Description>{t("transaction.dateHint")}</Description>
              {errors.tradeDate ? <FieldError>{errors.tradeDate}</FieldError> : null}
            </TextField>
            <Button onPress={handleSubmit} isDisabled={isSubmitting || !selected}>
              <Button.Label>
                {isSubmitting ? t("transaction.submitting") : t("transaction.submit")}
              </Button.Label>
            </Button>
            {createTransaction.isError ? (
              <Text className="text-danger text-sm text-center">
                {resolveCreateError(createTransaction.error)}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
