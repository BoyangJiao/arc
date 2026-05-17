/**
 * Persists Dev Tools FAB position + dock edge across cold starts (__DEV__ only).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DevToolsDockEdge = "left" | "right" | null;

interface DevToolsFabStore {
  /** Screen-space origin of FAB top-left. null = use default bottom-right. */
  x: number | null;
  y: number | null;
  docked: DevToolsDockEdge;
  panelOpen: boolean;
  setPosition: (x: number, y: number) => void;
  setDocked: (edge: DevToolsDockEdge) => void;
  setPanelOpen: (open: boolean) => void;
  toggleDocked: () => void;
}

const STORE_KEY = "arc:dev-tools-fab:v1";

export const useDevToolsFabStore = create<DevToolsFabStore>()(
  persist(
    (set, get) => ({
      x: null,
      y: null,
      docked: null,
      panelOpen: false,
      setPosition: (x, y) => set({ x, y, docked: null }),
      setDocked: (docked) => set({ docked }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      toggleDocked: () => {
        const { docked, x } = get();
        if (docked) {
          set({ docked: null });
          return;
        }
        // Snap to nearest edge based on last x (default right if unknown).
        const edge: DevToolsDockEdge = x !== null && x < 200 ? "left" : "right";
        set({ docked: edge, panelOpen: false });
      },
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ x: s.x, y: s.y, docked: s.docked }),
    }
  )
);
