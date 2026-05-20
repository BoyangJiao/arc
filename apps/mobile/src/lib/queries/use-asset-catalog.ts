/**
 * Batch-load asset metadata (name, symbol, market) for holdings / lists.
 */

import { useQuery } from "@tanstack/react-query";

import type { Market } from "@arc/core";

import { supabase } from "../supabase";

export interface AssetCatalogRow {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly market: Market;
}

export const assetCatalogQueryKey = (assetIds: readonly string[]) =>
  ["asset-catalog", [...assetIds].sort().join(",")] as const;

export const useAssetCatalog = (assetIds: readonly string[]) => {
  const sorted = [...assetIds].sort();

  return useQuery({
    queryKey: assetCatalogQueryKey(sorted),
    enabled: sorted.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<ReadonlyMap<string, AssetCatalogRow>> => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, symbol, market")
        .in("id", sorted);

      if (error) throw error;

      const map = new Map<string, AssetCatalogRow>();
      for (const row of data ?? []) {
        map.set(row.id as string, {
          id: row.id as string,
          name: row.name as string,
          symbol: row.symbol as string,
          market: row.market as Market,
        });
      }
      return map;
    },
  });
};
