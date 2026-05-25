/**
 * SymbolPicker — debounced cross-market symbol search list.
 */

import type { ReactNode } from "react";
import { FlatList, Pressable, View } from "react-native";
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

  return (
    <View className="flex-1 gap-3">
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
      <FlatList
        className="flex-1"
        data={search.data ?? []}
        keyExtractor={(item) => item.assetId}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        ListEmptyComponent={
          !queryReady ? (
            <Text className="text-muted text-sm">{emptyHint}</Text>
          ) : search.isFetching ? (
            <Text className="text-muted text-sm">…</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onSelect(item)} accessibilityRole="button">
            <Card className="mb-2">
              <View className="px-3 py-3">
                <Text className="text-foreground font-medium">
                  {item.name} ({item.assetId})
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
