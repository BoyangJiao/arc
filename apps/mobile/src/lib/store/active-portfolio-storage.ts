/**
 * Persisted key-value adapter for active portfolio store.
 * Native: MMKV. Web (Expo): AsyncStorage — MMKV has no web runtime.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createMMKV, type MMKV } from "react-native-mmkv";
import type { StateStorage } from "zustand/middleware";

let mmkv: MMKV | undefined;

const getMmkv = (): MMKV => {
  if (!mmkv) {
    mmkv = createMMKV({ id: "arc-mobile" });
  }
  return mmkv;
};

const asyncStorageAdapter: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
};

const mmkvAdapter: StateStorage = {
  getItem: (name) => getMmkv().getString(name) ?? null,
  setItem: (name, value) => {
    getMmkv().set(name, value);
  },
  removeItem: (name) => {
    getMmkv().remove(name);
  },
};

export const activePortfolioPersistStorage: StateStorage =
  Platform.OS === "web" ? asyncStorageAdapter : mmkvAdapter;
