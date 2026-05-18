/**
 * Root layout — providers + auth-gated navigation guards.
 *
 * Provider order (outside in):
 *   GestureHandlerRootView      — RN gesture system root
 *     SafeAreaProvider          — notch / home-indicator awareness
 *       HeroUINativeProvider    — HeroUI theme + portal root
 *         QueryClientProvider   — TanStack Query cache
 *           AuthProvider        — Supabase Auth session state
 *             AppShell          — drives BusinessTokensProvider from user prefs
 *               BusinessTokensProvider — gain/loss color from prefs
 *                 <Stack>       — expo-router file-based routing
 *
 * Auth guard logic (in AppShell):
 *   - loading=true → render Stack as-is (Splash-equivalent)
 *   - signed out + currently inside protected route → redirect to /sign-in
 *   - signed in + currently on /sign-in or /auth/* → redirect to /(tabs)
 *
 * Route structure (Stage 1 step 4):
 *   Stack (root)
 *   ├─ (tabs)        — Tab navigator (protected)
 *   ├─ portfolio/    — Portfolio detail + transactions (protected)
 *   ├─ me/           — Me page + settings (protected)
 *   ├─ sign-in       — Public
 *   └─ auth/         — Public (callback)
 */

import "../global.css";
import "@arc/i18n";

import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";

import {
  BusinessTokensProvider,
  DEFAULT_FINANCE_COLOR_MODE,
  HeroUINativeProvider,
  NAVIGATION_COLORS,
} from "@arc/ui";

import { DevToolsFloatingOverlay } from "../src/components/dev-tools/DevToolsFloatingOverlay";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { queryClient } from "../src/lib/query-client";
import { ThemeProvider, useColorMode } from "../src/lib/theme";
import { useUserPreferences } from "../src/lib/user-preferences";

/**
 * Design-token-aligned navigation colors.
 * Keep in sync with global.css Foundation tokens.
 * Values live in packages/ui/src/tokens/navigation-colors.ts (lint-exempted).
 */
const NAV_COLORS = NAVIGATION_COLORS;

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <HeroUINativeProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <AppShell />
              </AuthProvider>
            </QueryClientProvider>
          </HeroUINativeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Inner shell — has access to AuthContext + drives business token mode from prefs.
 * Kept as a separate component so providers above (HeroUI / SafeArea) don't re-render
 * on auth state changes.
 */
function AppShell() {
  const { session, loading } = useAuth();
  const { prefs } = useUserPreferences();
  const { colorMode } = useColorMode();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Determine if we're on a public route
    const seg0 = segments[0] as string | undefined;
    const inAuthFlow = seg0 === "sign-in" || seg0 === "auth";

    if (!session && !inAuthFlow) {
      // Logged-out user on a protected screen → bounce to sign-in.
      router.replace("/sign-in" as Href);
    } else if (session && inAuthFlow) {
      // Already signed in but somehow on the auth screen → go to tabs.
      router.replace("/(tabs)" as Href);
    }
  }, [session, loading, segments, router]);

  const colors = NAV_COLORS[colorMode];

  // Memoize screen options to avoid unnecessary re-renders of Stack children
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.text,
    }),
    [colors]
  );

  return (
    <BusinessTokensProvider mode={prefs?.financeColorMode ?? DEFAULT_FINANCE_COLOR_MODE}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="portfolio/[id]/index" options={{ headerShown: false }} />
          <Stack.Screen
            name="portfolio/[id]/transactions/new"
            options={{
              // ADR 006 §决策六: iOS native form sheet (card-stack effect, parent edge visible).
              // Web/Android fall back to a full-screen modal automatically.
              presentation: "formSheet",
              headerShown: true,
            }}
          />
          <Stack.Screen
            name="me/index"
            options={{
              headerShown: false,
              animation: "slide_from_left",
            }}
          />
          <Stack.Screen
            name="me/settings"
            options={{
              headerShown: false,
              animation: "slide_from_left",
            }}
          />
          <Stack.Screen
            name="me/dev-tools"
            options={{
              headerShown: false,
              animation: "slide_from_left",
            }}
          />
          <Stack.Screen
            name="markets/search"
            options={{
              presentation: "modal",
              headerShown: true,
            }}
          />
        </Stack>
        <DevToolsFloatingOverlay />
      </View>
    </BusinessTokensProvider>
  );
}
