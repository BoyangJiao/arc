/**
 * Symbol search — static list first, adapter SYMBOL_SEARCH fallback.
 *
 * Path B per watchlist-stage-2.md: protect AV free-tier quota for quote refresh.
 */

import type { PriceAdapter, SymbolSearchResult } from "./interfaces";
import { searchStaticSymbols } from "./static-symbols";

export interface SearchSymbolsParams {
  readonly query: string;
  readonly adapter: PriceAdapter;
  readonly staticLimit?: number;
}

/**
 * Search US symbols: curated static list when it has matches; otherwise adapter.
 */
export const searchSymbolsWithFallback = async (
  params: SearchSymbolsParams
): Promise<ReadonlyArray<SymbolSearchResult>> => {
  const { query, adapter, staticLimit = 20 } = params;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const staticHits = searchStaticSymbols(trimmed, staticLimit);
  if (staticHits.length > 0) {
    return staticHits;
  }

  if (!adapter.searchSymbols) {
    return [];
  }

  return adapter.searchSymbols(trimmed);
};
