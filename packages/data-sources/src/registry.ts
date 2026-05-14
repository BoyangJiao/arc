/**
 * Registry — 路由 Market → 对应 PriceAdapter
 *
 * Stage 1 仅注册 US（Alpha Vantage）。Stage 2-3 加 CN/HK/CRYPTO/FUND。
 *
 * 业务代码不直接持有 adapter，从 registry.resolvePriceAdapter(market) 拿。
 * 这样添加新市场时业务代码 0 改动。
 */

import { parseAssetId, type Market } from "@arc/core";

import { NotFoundError } from "./errors";
import type { FxAdapter, PriceAdapter } from "./interfaces";

export interface AdapterRegistry {
  resolvePriceAdapter(market: Market): PriceAdapter;
  resolvePriceAdapterByAssetId(assetId: string): PriceAdapter;
  fxAdapter: FxAdapter;
}

export interface RegistryConfig {
  /** Map of market → adapter. Markets without adapter throw on resolve. */
  priceAdapters: Partial<Record<Market, PriceAdapter>>;
  fxAdapter: FxAdapter;
}

export const createRegistry = (config: RegistryConfig): AdapterRegistry => {
  const { priceAdapters, fxAdapter } = config;

  const resolvePriceAdapter = (market: Market): PriceAdapter => {
    const adapter = priceAdapters[market];
    if (!adapter) {
      throw new NotFoundError("registry", `no price adapter for market ${market}`);
    }
    return adapter;
  };

  return {
    resolvePriceAdapter,
    resolvePriceAdapterByAssetId(assetId) {
      const { market } = parseAssetId(assetId);
      return resolvePriceAdapter(market);
    },
    fxAdapter,
  };
};
