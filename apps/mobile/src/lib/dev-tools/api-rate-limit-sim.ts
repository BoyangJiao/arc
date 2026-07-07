/**
 * Dev-only: unified RateLimitError simulation for market-data entry points
 * (symbol search, watchlist quotes, price fetches — C10 / J8 UAT).
 */

import { create } from "zustand";

import { RateLimitError } from "@arc/data-sources";

interface ApiRateLimitSimStore {
  armed: boolean;
  setArmed: (armed: boolean) => void;
}

export const useApiRateLimitSimStore = create<ApiRateLimitSimStore>((set) => ({
  armed: false,
  setArmed: (armed) => set({ armed: __DEV__ ? armed : false }),
}));

/** Non-reactive read for hooks that must not subscribe to the store. */
export const isApiRateLimitSimArmed = (): boolean =>
  __DEV__ && useApiRateLimitSimStore.getState().armed;

export const throwIfApiRateLimitSimArmed = (provider = "dev-sim"): void => {
  if (isApiRateLimitSimArmed()) {
    throw new RateLimitError(provider, 60, "dev sim");
  }
};
