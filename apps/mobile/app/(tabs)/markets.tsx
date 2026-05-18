/**
 * (tabs)/markets.tsx — Markets Tab / Watchlist (Stage 2 J8)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import {
  Button,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  Screen,
  SwipeableActionsRow,
  Text,
  WatchlistEmptyState,
  WatchlistRow,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { currencySymbol } from "../../src/lib/format-money";
import { useWatchlist } from "../../src/lib/queries/use-watchlist";

const formatChangePercent = (percent: Decimal): string => {
  if (percent.isZero()) return "0.00%";
  const sign = percent.isPositive() ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
};

export default function MarketsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const [forceRefresh, setForceRefresh] = useState(false);
  const quotePullIntentRef = useRef(false);
  const [quoteBanner, setQuoteBanner] = useState<{ message: string } | null>(null);

  const { rows, isPending, isFetching, refreshQuotes, remove, quoteRefreshFailureSummary } =
    useWatchlist({
      freshnessMs: forceRefresh ? 0 : undefined,
    });

  const { failedCount, rateLimitCount } = quoteRefreshFailureSummary;

  useEffect(() => {
    if (!isFetching && quotePullIntentRef.current) {
      quotePullIntentRef.current = false;
      setForceRefresh(false);
      if (failedCount > 0) {
        if (rateLimitCount > 0 && failedCount === rateLimitCount) {
          setQuoteBanner({ message: t("markets.quotesRefreshRateLimited") });
        } else {
          setQuoteBanner({
            message: t("markets.quotesRefreshPartialFail", { count: failedCount }),
          });
        }
      } else {
        setQuoteBanner(null);
      }
    }
  }, [isFetching, failedCount, rateLimitCount, t]);

  const openSearch = () => {
    router.push("/markets/search" as Href);
  };

  const handleRefresh = useCallback(() => {
    quotePullIntentRef.current = true;
    setForceRefresh(true);
    refreshQuotes();
  }, [refreshQuotes]);

  const isEmpty = !isPending && rows.length === 0;

  return (
    <Screen
      scroll
      refreshing={isFetching && rows.length > 0}
      onRefresh={handleRefresh}
      contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET, flexGrow: 1 }}
    >
      <View className="px-4 pt-4 gap-3 flex-1">
        <Text className="text-foreground text-xl font-semibold">{t("markets.title")}</Text>

        {!isEmpty && quoteBanner ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setQuoteBanner(null)}
            className="rounded-lg border border-danger/40 px-3 py-2 active:opacity-80"
          >
            <Text className="text-danger text-sm">{quoteBanner.message}</Text>
          </Pressable>
        ) : null}

        {isEmpty ? (
          <WatchlistEmptyState
            title={t("markets.emptyTitle")}
            description={t("markets.emptyDescription")}
            ctaLabel={t("markets.searchCta")}
            onCtaPress={openSearch}
          />
        ) : (
          <>
            <View className="gap-2">
              {rows.map((row) => {
                const priceLabel = row.quote
                  ? `${currencySymbol(row.quote.currency)}${row.quote.price.toFixed(2)}`
                  : isPending
                    ? t("markets.quoteLoading")
                    : t("markets.priceUnavailable");

                return (
                  <SwipeableActionsRow
                    key={row.id}
                    actions={[
                      {
                        key: "remove",
                        label: t("markets.remove"),
                        destructive: true,
                        accessibilityLabel: t("markets.remove"),
                        onPress: () => remove(row.id),
                      },
                    ]}
                  >
                    <WatchlistRow
                      symbol={row.asset.symbol}
                      name={row.asset.name}
                      priceLabel={priceLabel}
                      changePercent={row.quote?.changePercent ?? null}
                      stale={row.quote?.stale ?? false}
                      formatPercent={formatChangePercent}
                      onPress={() => {
                        if (__DEV__) {
                          console.info("[watchlist] row tap (Stage 2 no-op):", row.asset.id);
                        }
                      }}
                    />
                  </SwipeableActionsRow>
                );
              })}
            </View>

            <Text className="text-muted text-xs text-center">{t("markets.disclaimer")}</Text>

            <Button variant="primary" onPress={openSearch}>
              <Text>{t("markets.searchCta")}</Text>
            </Button>
          </>
        )}
      </View>
    </Screen>
  );
}
