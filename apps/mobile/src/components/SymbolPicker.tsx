/**
 * SymbolPicker — debounced cross-market symbol search (for use inside Screen ScrollView).
 *
 * No nested flex-1 FlatList — parent scroll keeps search pinned under market chips.
 */

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { Market } from "@arc/core";
import type { SymbolSearchResult } from "@arc/data-sources";
import { Card, Input, Text, TextField } from "@arc/ui";

import { AkshareSearchNotConfiguredError } from "../lib/market-data";
import { useSymbolSearchCrossMarket } from "../lib/queries";

export interface SymbolPickerProps {
  readonly market: Market;
  readonly query: string;
  readonly onQueryChange: (q: string) => void;
  readonly onSelect: (result: SymbolSearchResult) => void;
  readonly placeholder: string;
  readonly emptyHint: string;
  readonly searchUnavailable: string;
  readonly searchNoResults: string;
  readonly searchNotConfigured: string;
}

export function SymbolPicker({
  market,
  query,
  onQueryChange,
  onSelect,
  placeholder,
  emptyHint,
  searchUnavailable,
  searchNoResults,
  searchNotConfigured,
}: SymbolPickerProps): ReactNode {
  const search = useSymbolSearchCrossMarket(market, query);
  const trimmed = query.trim();
  const queryReady = trimmed.length >= 2;
  const notConfigured = search.isError && search.error instanceof AkshareSearchNotConfiguredError;
  const showNoResults =
    queryReady && !search.isFetching && search.isSuccess && (search.data?.length ?? 0) === 0;
  const showUnavailable = queryReady && !search.isFetching && search.isError && !notConfigured;

  const results = queryReady ? (search.data ?? []) : [];

  return (
    <View className="gap-3">
      <TextField>
        <Input
          placeholder={placeholder}
          value={query}
          onChangeText={onQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </TextField>
      {notConfigured ? <Text className="text-muted text-xs">{searchNotConfigured}</Text> : null}
      {showNoResults ? <Text className="text-muted text-xs">{searchNoResults}</Text> : null}
      {showUnavailable ? <Text className="text-danger text-xs">{searchUnavailable}</Text> : null}
      {!queryReady ? <Text className="text-muted text-sm">{emptyHint}</Text> : null}
      {queryReady && search.isFetching ? <Text className="text-muted text-sm">…</Text> : null}

      <View className="gap-2">
        {results.map((item) => (
          <Pressable key={item.assetId} onPress={() => onSelect(item)} accessibilityRole="button">
            <Card>
              <View className="px-3 py-3">
                <Text className="text-foreground font-medium">
                  {item.name} ({item.assetId})
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
