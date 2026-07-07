/**
 * Per-portfolio last-used market for tx entry default chip (Block C decision #11).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Market } from "@arc/core";

const keyFor = (portfolioId: string): string => `arc.lastUsedMarket.${portfolioId}`;

export const getLastUsedMarket = async (portfolioId: string): Promise<Market | null> => {
  const raw = await AsyncStorage.getItem(keyFor(portfolioId));
  if (!raw) return null;
  return raw as Market;
};

export const setLastUsedMarket = async (portfolioId: string, market: Market): Promise<void> => {
  await AsyncStorage.setItem(keyFor(portfolioId), market);
};

export const clearLastUsedMarket = async (portfolioId: string): Promise<void> => {
  await AsyncStorage.removeItem(keyFor(portfolioId));
};
