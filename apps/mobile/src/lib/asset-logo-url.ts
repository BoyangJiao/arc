/**
 * Resolve optional logo URL for holdings rows.
 *
 * CRYPTO: static icon CDN (no API key; matches bundled top-200 tickers).
 * US/CN/HK/FUND: monogram fallback in AssetAvatar — no logo URL at Stage 3.
 *
 * Stage 4 option for US: Finnhub `stock/profile2` → `logo` field (1 call/symbol,
 * needs caching + FINNHUB_API_KEY already used for quotes). Not wired yet to
 * avoid extra rate-limit surface on Portfolio Tab list scroll.
 */

import type { Market } from "@arc/core";

export const resolveAssetLogoUrl = (market: Market, symbol: string): string | null => {
  if (market !== "CRYPTO") return null;
  const normalized = symbol.trim().toLowerCase();
  if (!normalized) return null;
  return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color/${normalized}.png`;
};
