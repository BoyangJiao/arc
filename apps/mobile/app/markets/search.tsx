/**
 * markets/search.tsx — Watchlist symbol search modal (Stage 2 J8)
 */

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Button, Input, Screen, Text, TextField, useStackScreenOptions } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAddWatchlistItem, useWatchlistBase } from "../../src/lib/queries/use-watchlist";
import { useSymbolSearch } from "../../src/lib/queries/use-symbol-search";

export default function WatchlistSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const stackOptions = useStackScreenOptions({ title: t("markets.searchTitle") });

  const [query, setQuery] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  const { data: watchlist = [] } = useWatchlistBase();
  const inWatchlist = useMemo(() => new Set(watchlist.map((row) => row.asset.id)), [watchlist]);

  const search = useSymbolSearch(query);
  const addItem = useAddWatchlistItem();

  const handleSelect = async (assetId: string, symbol: string, name: string) => {
    if (inWatchlist.has(assetId)) {
      setBanner(t("markets.alreadyInWatchlist"));
      return;
    }

    try {
      await addItem.mutateAsync({ symbol, name });
      router.back();
    } catch (err) {
      if (err instanceof Error && err.message === "WATCHLIST_DUPLICATE") {
        setBanner(t("markets.alreadyInWatchlist"));
        return;
      }
      throw err;
    }
  };

  const inlineError =
    search.status === "rate_limited" || search.status === "error"
      ? t("markets.searchUnavailable")
      : null;

  return (
    <>
      <Stack.Screen options={stackOptions} />
      <Screen scroll contentContainerStyle={{ padding: 16, gap: 12 }}>
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

        {banner ? <Text className="text-warning text-sm">{banner}</Text> : null}

        {inlineError ? <Text className="text-danger text-sm">{inlineError}</Text> : null}

        {search.status === "loading" ? (
          <ActivityIndicator accessibilityLabel={t("markets.quoteLoading")} />
        ) : null}

        {query.trim().length > 0 && search.status === "ok" ? (
          <View className="gap-1">
            {search.results.map((hit) => {
              const added = inWatchlist.has(hit.assetId);
              return (
                <Pressable
                  key={hit.assetId}
                  onPress={() => {
                    if (added) {
                      setBanner(t("markets.alreadyInWatchlist"));
                      return;
                    }
                    void handleSelect(hit.assetId, hit.symbol, hit.name);
                  }}
                  className="flex-row items-center py-3 border-b border-border"
                  accessibilityRole="button"
                >
                  <View className="flex-1">
                    <Text className="text-foreground font-medium">{hit.symbol}</Text>
                    <Text className="text-muted text-xs" numberOfLines={1}>
                      {hit.name}
                    </Text>
                  </View>
                  <Text className="text-muted text-lg w-8 text-center">{added ? "✓" : "+"}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Button variant="secondary" onPress={() => router.back()}>
          <Text>{t("markets.cancel")}</Text>
        </Button>
      </Screen>
    </>
  );
}
