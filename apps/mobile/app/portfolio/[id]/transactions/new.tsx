/**
 * portfolio/[id]/transactions/new.tsx — Add Transaction (form sheet)
 *
 * Per IA v2.2 §四 + ADR 006 §决策六:
 * - Presentation: iOS form sheet (card-stack); configured on the Stack.Screen in app/_layout.tsx
 * - Form: asset symbol / type (BUY-only Stage 1) / date (today Stage 1) / shares / price / fee
 * - All financial values use Decimal (CLAUDE.md §3.1). Decimal.js parsing
 *   replaces the audit-flagged Number()/isNaN combo that violated the rule.
 * - assetId composed via composeAssetId(market, symbol) from @arc/core, not
 *   ad-hoc string concat (audit P0-5)
 * - currency derived from market (US → USD); no hardcoded "USD" fallback that
 *   could mismatch a user-typed "CN:..." prefix
 *
 * Stage 1 deliberate simplifications:
 * - Market locked to US — only adapter currently registered (Step 3)
 * - Type locked to BUY — sell/dividend/split arrive in Stage 3
 * - Date locked to today — DatePicker arrives in Fix 6 alongside Pro components
 * - Asset must exist in `assets` table (seeded via tools/seed-dev-data.ts); if a
 *   user types a symbol that's not pre-seeded, the FK insert will fail and we
 *   surface a clear error. Stage 2's asset-search Modal removes this friction.
 */

import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Decimal from "decimal.js";
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Screen,
  Text,
  TextField,
  useStackScreenOptions,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { composeAssetId, type Currency, type Market } from "@arc/core";

import { useCreateTransaction } from "../../../../src/lib/queries";

// Stage 1: only US market supported (Alpha Vantage adapter wired in Step 3).
const STAGE_1_MARKET: Market = "US";
const STAGE_1_MARKET_CURRENCY: Currency = "USD";

interface FormErrors {
  symbol?: string;
  shares?: string;
  pricePerShare?: string;
  fee?: string;
}

interface ValidatedValues {
  symbol: string;
  shares: Decimal;
  pricePerShare: Decimal;
  fee: Decimal;
}

/**
 * Parse a user-entered numeric string as Decimal.
 * Returns null on any input the Decimal constructor would reject (or on NaN).
 * Comma stripping handled here since decimal.js doesn't accept "1,000.00".
 */
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
  const { id: portfolioId } = useLocalSearchParams<{ id: string }>();

  const createTransaction = useCreateTransaction();

  // Form state — strings during input; converted to Decimal at validate/submit.
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [fee, setFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): { ok: false } | { ok: true; values: ValidatedValues } => {
    const next: FormErrors = {};

    const sym = symbol.trim().toUpperCase();
    if (!sym) next.symbol = t("transaction.required");

    const sharesD = tryDecimal(shares);
    if (!sharesD || sharesD.lte(0)) next.shares = t("transaction.invalidNumber");

    const priceD = tryDecimal(pricePerShare);
    if (!priceD || priceD.lte(0)) next.pricePerShare = t("transaction.invalidNumber");

    const feeD = fee.trim() ? tryDecimal(fee) : new Decimal(0);
    if (!feeD || feeD.lt(0)) next.fee = t("transaction.invalidNumber");

    setErrors(next);
    if (Object.keys(next).length > 0) return { ok: false };

    return {
      ok: true,
      values: {
        symbol: sym,
        // Non-null assertions safe — branches above guard each.
        shares: sharesD!,
        pricePerShare: priceD!,
        fee: feeD!,
      },
    };
  };

  const resolveCreateError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("SYMBOL_NOT_FOUND:")) {
      const sym = msg.slice("SYMBOL_NOT_FOUND:".length) || symbol.trim().toUpperCase();
      return t("transaction.symbolNotFound", { symbol: sym });
    }
    if (msg === "SYMBOL_RATE_LIMITED") {
      return t("transaction.symbolRateLimited");
    }
    return msg.length > 0 ? msg : t("common.error");
  };

  const handleSubmit = async () => {
    if (!portfolioId) return;
    const result = validate();
    if (!result.ok) return;

    const assetId = composeAssetId(STAGE_1_MARKET, result.values.symbol);

    try {
      await createTransaction.mutateAsync({
        portfolioId,
        assetId,
        type: "BUY",
        shares: result.values.shares.toString(),
        pricePerShare: result.values.pricePerShare.toString(),
        currency: STAGE_1_MARKET_CURRENCY,
        fee: result.values.fee.toString(),
        tradeDate: new Date().toISOString(),
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch {
      // Error surfaced via createTransaction.isError below.
    }
  };

  const isSubmitting = createTransaction.isPending;
  const todayLabel = new Date().toLocaleDateString();

  const screenOptions = useStackScreenOptions({
    title: t("transaction.addTitle"),
    backType: "close",
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen edges={["bottom"]}>
        <View className="gap-4">
          {/* Asset symbol — required, locked to US market in Stage 1 */}
          <TextField isRequired isInvalid={!!errors.symbol}>
            <Label>{t("portfolioDetail.asset")}</Label>
            <Input
              placeholder={t("transaction.assetSearch")}
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isSubmitting}
            />
            <Description>{t("transaction.marketUsHint")}</Description>
            {errors.symbol && <FieldError>{errors.symbol}</FieldError>}
          </TextField>

          {/* Type — Stage 1 locked to BUY (read-only indicator) */}
          <View>
            <Text className="text-foreground text-sm font-medium mb-1">
              {t("transaction.type")}
            </Text>
            <Text className="text-foreground text-base">{t("transaction.buy")}</Text>
            <Text className="text-muted text-xs mt-1">{t("transaction.typeLockedHint")}</Text>
          </View>

          {/* Date — Stage 1 locked to today (DatePicker arrives in Fix 6) */}
          <View>
            <Text className="text-foreground text-sm font-medium mb-1">
              {t("transaction.date")}
            </Text>
            <Text className="text-foreground text-base">{todayLabel}</Text>
            <Text className="text-muted text-xs mt-1">{t("transaction.dateLockedHint")}</Text>
          </View>

          {/* Shares */}
          <TextField isRequired isInvalid={!!errors.shares}>
            <Label>{t("transaction.shares")}</Label>
            <Input
              placeholder="0"
              value={shares}
              onChangeText={setShares}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
            {errors.shares && <FieldError>{errors.shares}</FieldError>}
          </TextField>

          {/* Price per share */}
          <TextField isRequired isInvalid={!!errors.pricePerShare}>
            <Label>
              {t("transaction.pricePerShare")} ({STAGE_1_MARKET_CURRENCY})
            </Label>
            <Input
              placeholder="0.00"
              value={pricePerShare}
              onChangeText={setPricePerShare}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
            {errors.pricePerShare && <FieldError>{errors.pricePerShare}</FieldError>}
          </TextField>

          {/* Fee */}
          <TextField isInvalid={!!errors.fee}>
            <Label>
              {t("transaction.fee")} ({STAGE_1_MARKET_CURRENCY})
            </Label>
            <Input
              placeholder="0.00"
              value={fee}
              onChangeText={setFee}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
            {errors.fee && <FieldError>{errors.fee}</FieldError>}
          </TextField>

          {/* Notes */}
          <TextField>
            <Label>{t("transaction.notes")}</Label>
            <Input
              placeholder={t("transaction.notesPlaceholder")}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              editable={!isSubmitting}
            />
          </TextField>

          {/* Submit */}
          <View className="mt-4">
            <Button onPress={handleSubmit} isDisabled={isSubmitting}>
              <Button.Label>
                {isSubmitting ? t("transaction.validatingSymbol") : t("transaction.submit")}
              </Button.Label>
            </Button>
          </View>

          {/* Error display (e.g. FK violation when asset isn't pre-seeded) */}
          {createTransaction.isError && (
            <Text className="text-danger text-sm text-center">
              {resolveCreateError(createTransaction.error)}
            </Text>
          )}
        </View>
      </Screen>
    </>
  );
}
