/**
 * SymbolPicker — debounced cross-market symbol search list.
 */

import type { ReactNode } from "react";
import { FlatList, Pressable, View } from "react-native";
import type { Market } from "@arc/core";
import type { SymbolSearchResult } from "@arc/data-sources";
import { Card, Input, Text, TextField } from "@arc/ui";

import { useSymbolSearchCrossMarket } from "../lib/queries";

export interface SymbolPickerProps {
  readonly market: Market;
  readonly query: string;
  readonly onQueryChange: (q: string) => void;
  readonly onSelect: (result: SymbolSearchResult) => void;
  readonly placeholder: string;
  readonly emptyHint: string;
  readonly searchUnavailable: string;
}

export function SymbolPicker({
  market,
  query,
  onQueryChange,
  onSelect,
  placeholder,
  emptyHint,
  searchUnavailable,
}: SymbolPickerProps): ReactNode {
  const search = useSymbolSearchCrossMarket(market, query);
  const showUnavailable =
    query.trim().length >= 2 && !search.isFetching && (search.data?.length ?? 0) === 0;

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
      {showUnavailable && search.isSuccess ? (
        <Text className="text-muted text-xs">{searchUnavailable}</Text>
      ) : null}
      <FlatList
        data={search.data ?? []}
        keyExtractor={(item) => item.assetId}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim().length < 2 ? (
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
