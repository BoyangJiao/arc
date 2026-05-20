/**
 * Active portfolio id — Zustand + MMKV (native) / AsyncStorage (web).
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { activePortfolioPersistStorage } from "./active-portfolio-storage";

const STORE_KEY = "arc.activePortfolioId";

interface ActivePortfolioState {
  activePortfolioId: string | null;
  setActivePortfolioId: (id: string | null) => void;
}

export const useActivePortfolioStore = create<ActivePortfolioState>()(
  persist(
    (set) => ({
      activePortfolioId: null,
      setActivePortfolioId: (id) => set({ activePortfolioId: id }),
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => activePortfolioPersistStorage),
      partialize: (state) => ({ activePortfolioId: state.activePortfolioId }),
    }
  )
);
