/**
 * Dev-only: simulate RateLimitError on watchlist quote fetches (J8 UI / banner UAT).
 * No network — toggled from DEV tools panel. Production / non-__DEV__ builds ignore.
 */

import { create } from "zustand";

import { RateLimitError } from "@arc/data-sources";

interface WatchlistRateLimitSimStore {
  armed: boolean;
  setArmed: (armed: boolean) => void;
}

export const useWatchlistRateLimitSimStore = create<WatchlistRateLimitSimStore>((set) => ({
  armed: false,
  setArmed: (armed) => set({ armed: __DEV__ ? armed : false }),
}));

/** Non-reactive read for hooks that must not subscribe to the store. */
export const isWatchlistRateLimitSimArmed = (): boolean =>
  __DEV__ && useWatchlistRateLimitSimStore.getState().armed;

export const throwIfWatchlistRateLimitSimArmed = (): void => {
  if (isWatchlistRateLimitSimArmed()) {
    throw new RateLimitError("finnhub", null, "dev sim");
  }
};
