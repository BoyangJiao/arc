/**
 * Full transaction entry (BUY / SELL / DIVIDEND / SPLIT).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter, Stack, type Href } from "expo-router";
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
import { composeAssetId, type Currency, type Market, type TransactionType } from "@arc/core";
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
  resolveTotalInvestedAmount,
  type AmountEntryMode,
} from "../../../../../src/lib/transaction-form-presenter";

const TX_TYPES: readonly TransactionType[] = ["BUY", "SELL", "DIVIDEND", "SPLIT"];

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
  shares?: string;
  pricePerShare?: string;
  amount?: string;
  fee?: string;
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

export default function AddTransactionScreen() {
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
  const [txType, setTxType] = useState<TransactionType>("BUY");
  const [amountMode, setAmountMode] = useState<AmountEntryMode>("shares");
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [fee, setFee] = useState("0");
  const [tradeDate, setTradeDate] = useState(todayIsoDate);
  const [notes, setNotes] = useState("");
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

  const resolveAmountFields = (): { shares: Decimal; pricePerShare: Decimal } | null => {
    if (txType === "BUY" && amountMode === "total") {
      return resolveTotalInvestedAmount(tryDecimal(shares), tryDecimal(totalAmount));
    }
    if (txType !== "BUY") {
      const sharesD = tryDecimal(shares);
      const priceD = tryDecimal(pricePerShare);
      if (!sharesD || sharesD.lte(0) || !priceD || priceD.lte(0)) return null;
      return { shares: sharesD, pricePerShare: priceD };
    }
    return resolveSharesAndUnitPrice(
      amountMode,
      tryDecimal(shares),
      tryDecimal(pricePerShare),
      tryDecimal(totalAmount)
    );
  };

  const validateStep2 = (): boolean => {
    const next: FormErrors = {};
    const resolved = resolveAmountFields();
    if (!resolved) {
      if (txType === "BUY" && amountMode === "total") {
        next.amount = t("transaction.invalidNumber");
      } else {
        if (!tryDecimal(shares) || tryDecimal(shares)!.lte(0)) {
          next.shares = t("transaction.invalidNumber");
        }
        if (!tryDecimal(pricePerShare) || tryDecimal(pricePerShare)!.lte(0)) {
          next.pricePerShare = t("transaction.invalidNumber");
        }
      }
    }
    const feeD = fee.trim() ? tryDecimal(fee) : new Decimal(0);
    if (!feeD || feeD.lt(0)) next.fee = t("transaction.invalidNumber");
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

    const resolved = resolveAmountFields();
    if (!resolved) return;

    const { shares: sharesD, pricePerShare: priceD } = resolved;
    const feeD = fee.trim() ? tryDecimal(fee)! : new Decimal(0);

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
        type: txType,
        shares: sharesD.toString(),
        pricePerShare: priceD.toString(),
        currency: selected.currency,
        fee: feeD.toString(),
        tradeDate: new Date(`${tradeDate}T12:00:00.000Z`).toISOString(),
        notes: notes.trim() || undefined,
        assetMeta,
      });
      setSubmitSuccess(true);
    } catch {
      /* surfaced below */
    }
  };

  const resetForContinue = () => {
    setSubmitSuccess(false);
    setStep(1);
    setSelected(null);
    setSearchQuery("");
    setShares("");
    setPricePerShare("");
    setTotalAmount("");
    setAmountMode("shares");
    setFee("0");
    setTradeDate(todayIsoDate());
    setNotes("");
    setErrors({});
  };

  const isSubmitting = createTransaction.isPending;

  if (submitSuccess) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, presentation: "formSheet" }} />
        <Screen edges={["bottom"]}>
          <InScreenHeader title={t("transaction.addTitle")} leftType="close" />
          <View className="gap-4 items-center py-8">
            <Text className="text-foreground text-center">{t("transaction.success")}</Text>
            <Button onPress={resetForContinue}>
              <Button.Label>{t("transaction.continueEntry")}</Button.Label>
            </Button>
            <Button variant="secondary" onPress={() => router.replace("/(tabs)" as Href)}>
              <Button.Label>{t("transaction.doneBackToPortfolio")}</Button.Label>
            </Button>
          </View>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "formSheet" }} />
      <Screen scroll={step !== 1} edges={["bottom"]}>
        <InScreenHeader title={t("transaction.addTitle")} leftType="close" />
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
              <View className="flex-row flex-wrap gap-2">
                {TX_TYPES.map((type) => {
                  const label =
                    type === "BUY"
                      ? t("transaction.buy")
                      : type === "SELL"
                        ? t("transaction.sell")
                        : type === "DIVIDEND"
                          ? t("transaction.dividend")
                          : t("transaction.split");
                  return (
                    <Button
                      key={type}
                      variant={txType === type ? "primary" : "secondary"}
                      onPress={() => setTxType(type)}
                    >
                      <Button.Label>{label}</Button.Label>
                    </Button>
                  );
                })}
              </View>
              {txType === "BUY" ? (
                <TransactionAmountModeToggle
                  mode={amountMode as TransactionAmountMode}
                  onModeChange={setAmountMode}
                  sharesLabel={t("transaction.amount.toggle.shares")}
                  totalLabel={t("transaction.amount.toggle.total")}
                />
              ) : null}
              <TextField isRequired isInvalid={!!errors.shares || !!errors.amount}>
                <Label>{t("transaction.shares")}</Label>
                <Input
                  value={shares}
                  onChangeText={setShares}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                {errors.shares ? <FieldError>{errors.shares}</FieldError> : null}
                {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
              </TextField>
              {txType === "BUY" && amountMode === "total" ? (
                <TextField isRequired isInvalid={!!errors.amount}>
                  <Label>{t("transaction.snapshot.totalInvested.label", { currency })}</Label>
                  <Input
                    value={totalAmount}
                    onChangeText={setTotalAmount}
                    keyboardType="decimal-pad"
                    editable={!isSubmitting}
                  />
                  <Description>{t("transaction.snapshot.totalInvested.hint")}</Description>
                  {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
                </TextField>
              ) : (
                <TextField isRequired isInvalid={!!errors.pricePerShare}>
                  <Label>
                    {t("transaction.pricePerShare")} ({currency})
                  </Label>
                  <Input
                    value={pricePerShare}
                    onChangeText={setPricePerShare}
                    keyboardType="decimal-pad"
                    editable={!isSubmitting}
                  />
                  {errors.pricePerShare ? <FieldError>{errors.pricePerShare}</FieldError> : null}
                </TextField>
              )}
              <TextField isInvalid={!!errors.fee}>
                <Label>
                  {t("transaction.fee")} ({currency})
                </Label>
                <Input
                  value={fee}
                  onChangeText={setFee}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                {errors.fee && <FieldError>{errors.fee}</FieldError>}
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
                {errors.tradeDate && <FieldError>{errors.tradeDate}</FieldError>}
              </TextField>
              <TextField>
                <Label>{t("transaction.notes")}</Label>
                <Input
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                  editable={!isSubmitting}
                />
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
    </>
  );
}
