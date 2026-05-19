/**
 * markets/search.tsx — Watchlist symbol search modal (Stage 2 J8)
 */

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  Button,
  InScreenHeader,
  Input,
  Screen,
  Text,
  TextField,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAddWatchlistItem, useWatchlistBase } from "../../src/lib/queries/use-watchlist";
import { useSymbolSearch } from "../../src/lib/queries/use-symbol-search";

type BannerKind = "info" | "error";

export default function WatchlistSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [banner, setBanner] = useState<{ kind: BannerKind; message: string } | null>(null);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);

  const { data: watchlist = [] } = useWatchlistBase();
  const inWatchlist = useMemo(() => new Set(watchlist.map((row) => row.asset.id)), [watchlist]);

  const search = useSymbolSearch(query);
  const addItem = useAddWatchlistItem();

  const showBanner = (kind: BannerKind, message: string) => {
    setBanner({ kind, message });
  };

  const handleSelect = async (assetId: string, symbol: string, name: string) => {
    if (addItem.isPending) return;

    if (inWatchlist.has(assetId)) {
      showBanner("info", t("markets.alreadyInWatchlist"));
      return;
    }

    setAddingSymbol(symbol);
    setBanner(null);

    try {
      await addItem.mutateAsync({ symbol, name });
      router.back();
    } catch (err) {
      if (err instanceof Error && err.message === "WATCHLIST_DUPLICATE") {
        showBanner("info", t("markets.alreadyInWatchlist"));
        return;
      }
      if (__DEV__ && err instanceof Error) {
        console.warn("[watchlist] add failed:", err.message, err);
      }
      showBanner("error", t("markets.addFailed"));
    } finally {
      setAddingSymbol(null);
    }
  };

  const inlineError =
    search.status === "rate_limited" || search.status === "error"
      ? t("markets.searchUnavailable")
      : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />
      <Screen
        scroll
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{
          paddingTop: 0,
          paddingHorizontal: 16,
          paddingBottom: 16,
          gap: 12,
        }}
      >
        <InScreenHeader title={t("markets.searchTitle")} leftType="close" density="comfortable" />
        <TextField>
          <Input
            value={query}
            onChangeText={(text) => {
              setBanner(null);
              setQuery(text);
            }}
            placeholder={t("markets.searchPlaceholder")}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
        </TextField>

        <Text className="text-muted text-xs">{t("markets.scopeHint")}</Text>

        {banner ? (
          <Text
            className={`text-sm ${banner.kind === "error" ? "text-danger" : "text-muted-foreground"}`}
          >
            {banner.message}
          </Text>
        ) : null}

        {addItem.isPending ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" />
            <Text className="text-muted text-sm">{t("markets.adding")}</Text>
          </View>
        ) : null}

        {inlineError ? <Text className="text-danger text-sm">{inlineError}</Text> : null}

        {search.status === "loading" ? (
          <ActivityIndicator accessibilityLabel={t("markets.quoteLoading")} />
        ) : null}

        {query.trim().length > 0 && search.status === "ok" ? (
          <View className="gap-1">
            {search.results.map((hit) => {
              const added = inWatchlist.has(hit.assetId);
              const isAdding = addingSymbol === hit.symbol;
              const disabled = addItem.isPending;

              return (
                <Pressable
                  key={hit.assetId}
                  disabled={disabled}
                  onPress={() => {
                    void handleSelect(hit.assetId, hit.symbol, hit.name);
                  }}
                  className={`flex-row items-center py-3 border-b border-border ${
                    disabled ? "opacity-50" : "active:opacity-70"
                  }`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, busy: isAdding }}
                >
                  <View className="flex-1">
                    <Text className="text-foreground font-medium">{hit.symbol}</Text>
                    <Text className="text-muted text-xs" numberOfLines={1}>
                      {hit.name}
                    </Text>
                  </View>
                  {isAdding ? (
                    <ActivityIndicator size="small" className="w-8" />
                  ) : (
                    <Text className="text-muted text-lg w-8 text-center">{added ? "✓" : "+"}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Button variant="ghost" onPress={() => router.back()} isDisabled={addItem.isPending}>
          {t("markets.cancel")}
        </Button>
      </Screen>
    </>
  );
}
