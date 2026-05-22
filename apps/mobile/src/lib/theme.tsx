/**
 * theme.tsx — App-level color mode (light/dark) context
 *
 * Uses React Native's Appearance API to switch color scheme.
 * Uniwind automatically listens for Appearance changes and re-renders
 * all className-based styles with the correct dark: variant tokens.
 *
 * Stage 1: state only (no persistence). Stage 2+ can add AsyncStorage/MMKV.
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Appearance } from "react-native";

export type ColorMode = "light" | "dark";

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
 * On mount, reads system preference via Appearance.getColorScheme().
 * Toggle programmatically sets Appearance.setColorScheme() which
 * Uniwind's runtime picks up to resolve dark: prefix classes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    const system = Appearance.getColorScheme();
    return system === "dark" ? "dark" : "light";
  });

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    Appearance.setColorScheme(mode);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorModeState((prev) => {
      const next: ColorMode = prev === "light" ? "dark" : "light";
      Appearance.setColorScheme(next);
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
