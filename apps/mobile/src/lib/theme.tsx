/**
 * theme.tsx — App-level color mode (light/dark) context
 *
 * Uses React Native's Appearance API to switch color scheme.
 * Uniwind automatically listens for Appearance changes and re-renders
 * all className-based styles with the correct dark: variant tokens.
 *
 * Persists the user's explicit choice in AsyncStorage (`arc.colorMode`) so
 * restarts keep light/dark; first launch (no key) follows system appearance.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Appearance } from "react-native";

export type ColorMode = "light" | "dark";

/** AsyncStorage — keep in sync with `run-reset-clean.ts` doc comment. */
export const COLOR_MODE_STORAGE_KEY = "arc.colorMode";

function parseStoredColorMode(raw: string | null): ColorMode | null {
  if (raw === "light" || raw === "dark") return raw;
  return null;
}

interface ThemeContextValue {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorMode: "light",
  toggleColorMode: () => {},
  setColorMode: () => {},
});

/**
 * ThemeProvider — wrap at root to provide color mode switching.
 *
 * First paint uses system `Appearance`; then hydrates from AsyncStorage when
 * the user has previously chosen light/dark. `setColorMode` / `toggleColorMode`
 * persist to storage and call `Appearance.setColorScheme` so Uniwind resolves
 * `dark:` classes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const userChoseModeRef = useRef(false);

  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    const system = Appearance.getColorScheme();
    return system === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(COLOR_MODE_STORAGE_KEY);
        if (cancelled || userChoseModeRef.current) return;
        const stored = parseStoredColorMode(raw);
        if (stored) {
          setColorModeState(stored);
          Appearance.setColorScheme(stored);
        }
      } catch {
        // Unavailable storage — keep system-derived initial state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    userChoseModeRef.current = true;
    setColorModeState(mode);
    Appearance.setColorScheme(mode);
    void AsyncStorage.setItem(COLOR_MODE_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const toggleColorMode = useCallback(() => {
    userChoseModeRef.current = true;
    setColorModeState((prev) => {
      const next: ColorMode = prev === "light" ? "dark" : "light";
      Appearance.setColorScheme(next);
      void AsyncStorage.setItem(COLOR_MODE_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ colorMode, toggleColorMode, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useColorMode — read current color mode + toggle/set methods.
 *
 * @example
 *   const { colorMode, toggleColorMode } = useColorMode();
 *   <Switch
 *     isSelected={colorMode === 'dark'}
 *     onSelectedChange={(selected) => setColorMode(selected ? 'dark' : 'light')}
 *   />
 */
export function useColorMode(): ThemeContextValue {
  return useContext(ThemeContext);
}
