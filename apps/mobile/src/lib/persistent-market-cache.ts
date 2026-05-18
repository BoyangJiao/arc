/**
 * Device-persistent quote/FX cache (AsyncStorage) — survives app restarts.
 *
 * Layer order in market-data.ts: memory → persistent → Supabase.
 */

import Decimal from "decimal.js";
import type { Currency, FxRate, PriceQuote } from "@arc/core";
import type { FxCache, PriceCache } from "@arc/data-sources";

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface StoredQuote {
  assetId: string;
  price: string;
  currency: Currency;
  asOf: string;
  source: string;
  storedAt: number;
  /** Serialized Decimal; absent on legacy cache rows */
  changePercent?: string | null;
}

interface StoredFx {
  from: Currency;
  to: Currency;
  rate: string;
  asOf: string;
  source: string;
  storedAt: number;
}

const priceKey = (assetId: string): string => `@arc/market-cache/v1/price/${assetId}`;
const fxKey = (from: Currency, to: Currency): string => `@arc/market-cache/v1/fx/${from}->${to}`;

const reviveQuote = (row: StoredQuote): PriceQuote => {
  const base: PriceQuote = {
    assetId: row.assetId,
    price: new Decimal(row.price),
    currency: row.currency,
    asOf: row.asOf,
    source: row.source,
  };
  if (row.changePercent != null && row.changePercent !== "") {
    try {
      return { ...base, changePercent: new Decimal(row.changePercent) };
    } catch {
      return base;
    }
  }
  return base;
};

const reviveFx = (row: StoredFx): FxRate => ({
  from: row.from,
  to: row.to,
  rate: new Decimal(row.rate),
  asOf: row.asOf,
  source: row.source,
});

export const createPersistentPriceCache = (
  storage: KeyValueStorage,
  backend: PriceCache
): PriceCache => ({
  async get(assetId, freshnessMs) {
    try {
      const raw = await storage.getItem(priceKey(assetId));
      if (raw) {
        const row = JSON.parse(raw) as StoredQuote;
        if (Date.now() - row.storedAt <= freshnessMs) {
          return reviveQuote(row);
        }
      }
    } catch {
      // Corrupt entry — fall through to backend.
    }

    const fromBackend = await backend.get(assetId, freshnessMs);
    if (fromBackend) {
      const row: StoredQuote = {
        assetId: fromBackend.assetId,
        price: fromBackend.price.toString(),
        currency: fromBackend.currency,
        asOf: fromBackend.asOf,
        source: fromBackend.source,
        storedAt: Date.now(),
        changePercent:
          fromBackend.changePercent != null ? fromBackend.changePercent.toString() : undefined,
      };
      try {
        await storage.setItem(priceKey(assetId), JSON.stringify(row));
      } catch {
        // Quota / platform errors — memory layer still helps this session.
      }
    }
    return fromBackend;
  },

  async set(quote) {
    const row: StoredQuote = {
      assetId: quote.assetId,
      price: quote.price.toString(),
      currency: quote.currency,
      asOf: quote.asOf,
      source: quote.source,
      storedAt: Date.now(),
      changePercent: quote.changePercent != null ? quote.changePercent.toString() : undefined,
    };
    try {
      await storage.setItem(priceKey(quote.assetId), JSON.stringify(row));
    } catch {
      // Non-fatal — Supabase / memory may still hold the quote.
    }
    await backend.set(quote);
  },
});

export const createPersistentFxCache = (storage: KeyValueStorage, backend: FxCache): FxCache => ({
  async get(from, to, freshnessMs) {
    try {
      const raw = await storage.getItem(fxKey(from, to));
      if (raw) {
        const row = JSON.parse(raw) as StoredFx;
        if (Date.now() - row.storedAt <= freshnessMs) {
          return reviveFx(row);
        }
      }
    } catch {
      // fall through
    }

    const fromBackend = await backend.get(from, to, freshnessMs);
    if (fromBackend) {
      const row: StoredFx = {
        from: fromBackend.from,
        to: fromBackend.to,
        rate: fromBackend.rate.toString(),
        asOf: fromBackend.asOf,
        source: fromBackend.source,
        storedAt: Date.now(),
      };
      try {
        await storage.setItem(fxKey(from, to), JSON.stringify(row));
      } catch {
        // ignore
      }
    }
    return fromBackend;
  },

  async set(rate) {
    const row: StoredFx = {
      from: rate.from,
      to: rate.to,
      rate: rate.rate.toString(),
      asOf: rate.asOf,
      source: rate.source,
      storedAt: Date.now(),
    };
    try {
      await storage.setItem(fxKey(rate.from, rate.to), JSON.stringify(row));
    } catch {
      // ignore
    }
    await backend.set(rate);
  },
});
