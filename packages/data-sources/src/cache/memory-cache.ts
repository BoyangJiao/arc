/**
 * In-memory cache layers — session-local read-through over Supabase caches.
 *
 * Stage 1: Supabase client writes to price_snapshots / fx_rates often fail RLS;
 * memory still prevents repeated Alpha Vantage calls within one app session.
 */

import type { Currency, FxRate, PriceQuote } from "@arc/core";

import type { FxCache, PriceCache } from "../interfaces";

interface MemoryEntry<T> {
  value: T;
  storedAt: number;
}

export const createMemoryPriceCache = (backend: PriceCache): PriceCache => {
  const memory = new Map<string, MemoryEntry<PriceQuote>>();

  return {
    async get(assetId, freshnessMs) {
      const hit = memory.get(assetId);
      if (hit && Date.now() - hit.storedAt <= freshnessMs) {
        return hit.value;
      }

      const fromDb = await backend.get(assetId, freshnessMs);
      if (fromDb) {
        memory.set(assetId, { value: fromDb, storedAt: Date.now() });
      }
      return fromDb;
    },

    async set(quote) {
      memory.set(quote.assetId, { value: quote, storedAt: Date.now() });
      await backend.set(quote);
    },
  };
};

export const createMemoryFxCache = (backend: FxCache): FxCache => {
  const memory = new Map<string, MemoryEntry<FxRate>>();

  const pairKey = (from: Currency, to: Currency): string => `${from}->${to}`;

  return {
    async get(from, to, freshnessMs) {
      const key = pairKey(from, to);
      const hit = memory.get(key);
      if (hit && Date.now() - hit.storedAt <= freshnessMs) {
        return hit.value;
      }

      const fromDb = await backend.get(from, to, freshnessMs);
      if (fromDb) {
        memory.set(key, { value: fromDb, storedAt: Date.now() });
      }
      return fromDb;
    },

    async set(rate) {
      memory.set(pairKey(rate.from, rate.to), { value: rate, storedAt: Date.now() });
      await backend.set(rate);
    },
  };
};
