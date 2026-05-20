/**
 * Persisted key-value adapter for active portfolio store — AsyncStorage on all platforms.
 *
 * Stage 3 Block B reshape 2026-05-20 (决策 8 修订): MMKV 是 native module，Expo Go
 * 不内置，引入会让 Stage 3 自用阶段被迫切 Dev Build。activePortfolioId 是低频写场景
 * (< 10 次/天)，AsyncStorage < 10ms boot read 完全足够。MMKV 评估推到 Stage 4 + 真出现
 * high-frequency write hotspot 后再换。
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

export const activePortfolioPersistStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
};
