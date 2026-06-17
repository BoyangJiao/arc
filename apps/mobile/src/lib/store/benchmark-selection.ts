/**
 * Benchmark selection — which 指数对标 benchmarks are active per portfolio.
 *
 * Local persisted pref (ADR 017 D8 — no DB migration; ≤ MAX_BENCHMARKS). Empty =
 * the UI falls back to defaultBenchmarkId(reportingCurrency). Picking a 3rd drops
 * the oldest (FIFO), so selection stays within the cap.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { MAX_BENCHMARKS } from "../benchmark-catalog";
import { activePortfolioPersistStorage } from "./active-portfolio-storage";

const STORE_KEY = "arc.benchmarkSelection";

interface BenchmarkSelectionState {
  /** portfolioId → selected benchmark ids (≤ MAX_BENCHMARKS). */
  byPortfolio: Record<string, string[]>;
  toggle: (portfolioId: string, benchmarkId: string) => void;
  setSelected: (portfolioId: string, ids: string[]) => void;
}

export const useBenchmarkSelectionStore = create<BenchmarkSelectionState>()(
  persist(
    (set) => ({
      byPortfolio: {},
      toggle: (portfolioId, benchmarkId) =>
        set((state) => {
          const current = state.byPortfolio[portfolioId] ?? [];
          let next: string[];
          if (current.includes(benchmarkId)) {
            next = current.filter((id) => id !== benchmarkId);
          } else if (current.length >= MAX_BENCHMARKS) {
            next = [...current.slice(1), benchmarkId]; // drop oldest
          } else {
            next = [...current, benchmarkId];
          }
          return { byPortfolio: { ...state.byPortfolio, [portfolioId]: next } };
        }),
      setSelected: (portfolioId, ids) =>
        set((state) => ({
          byPortfolio: { ...state.byPortfolio, [portfolioId]: ids.slice(0, MAX_BENCHMARKS) },
        })),
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => activePortfolioPersistStorage),
      partialize: (state) => ({ byPortfolio: state.byPortfolio }),
    }
  )
);
