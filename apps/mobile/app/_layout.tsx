/**
 * Root layout — providers + auth-gated navigation guards.
 *
 * Provider order (outside in):
 *   GestureHandlerRootView      — RN gesture system root
 *     SafeAreaProvider          — notch / home-indicator awareness
 *       HeroUINativeProvider    — HeroUI theme + portal root
 *         PersistQueryClientProvider — TanStack Query cache + MMKV persistence
 *           AuthProvider        — Supabase Auth session state
 *             AppShell          — drives BusinessTokensProvider from user prefs
 *               BusinessTokensProvider — gain/loss color from prefs
 *                 <Stack>       — expo-router file-based routing
 *
 * Persist gate (offline-cache-stage-3.md §决策 7):
 *   MMKV init is async (secure-store key read). We await `buildPersister()` before
 *   mounting PersistQueryClientProvider so rehydrate happens before auth routing.
 *   While the persister is initializing we stay on splash (persisterReady=false).
 *   If the persister returns null (web / secure-store failure) we fall back to
 *   plain QueryClientProvider — correctness is preserved, cold-start speed degrades.
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
import i18n from "@arc/i18n";

import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import {
  BusinessTokensProvider,
  DEFAULT_FINANCE_COLOR_MODE,
  HeroUINativeProvider,
  NAVIGATION_COLORS,
} from "@arc/ui";

import { DevToolsFloatingOverlay } from "../src/components/dev-tools/DevToolsFloatingOverlay";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { REVYL_BYPASS_ENABLED } from "../src/lib/revyl-auth-bypass";
import {
  buildPersister,
  shouldPersistQuery,
  QUERY_CACHE_BUSTER,
  CACHE_MAX_AGE_MS,
} from "../src/lib/cache/query-persister";
import { queryClient } from "../src/lib/query-client";
import { ThemeProvider, useColorMode } from "../src/lib/theme";
import { useUserPreferences } from "../src/lib/user-preferences";
import type { Persister } from "@tanstack/react-query-persist-client";

/**
 * Design-token-aligned navigation colors.
 * Keep in sync with global.css Foundation tokens.
 * Values live in packages/ui/src/tokens/navigation-colors.ts (lint-exempted).
 */
const NAV_COLORS = NAVIGATION_COLORS;

export default function RootLayout() {
  // Persist gate: await MMKV encrypted init before rendering the query tree.
  // `null` = persister unavailable (web/failure) — use plain QueryClientProvider.
  const [persister, setPersister] = useState<Persister | null | undefined>(undefined);

  useEffect(() => {
    buildPersister()
      .then(setPersister)
      .catch(() => setPersister(null));
  }, []);

  // Still initializing — stay on splash (blank view preserves current splash screen).
  if (persister === undefined) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <HeroUINativeProvider>
            {persister ? (
              <PersistQueryClientProvider
                client={queryClient}
                persistOptions={{
                  persister,
                  buster: QUERY_CACHE_BUSTER,
                  maxAge: CACHE_MAX_AGE_MS,
                  dehydrateOptions: {
                    shouldDehydrateQuery: shouldPersistQuery,
                  },
                }}
              >
                <AuthProvider>
                  <AppShell />
                </AuthProvider>
              </PersistQueryClientProvider>
            ) : (
              // Fallback: web or secure-store unavailable → plain provider, no persistence.
              <QueryClientProvider client={queryClient}>
                <AuthProvider>
                  <AppShell />
                </AuthProvider>
              </QueryClientProvider>
            )}
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
  const { session, loading: authLoading } = useAuth();
  const { prefs, loading: prefsLoading } = useUserPreferences();
  const { colorMode } = useColorMode();
  const segments = useSegments();
  const router = useRouter();

  // Apply the persisted UI language on cold start (and whenever it changes).
  // i18n initializes with a hardcoded default lng; without this the stored
  // `prefs.locale` (e.g. "en") would silently revert to the default on restart.
  // Mirrors how BusinessTokensProvider consumes prefs.financeColorMode below.
  useEffect(() => {
    if (prefs?.locale && prefs.locale !== i18n.language) {
      void i18n.changeLanguage(prefs.locale);
    }
  }, [prefs?.locale]);

  useEffect(() => {
    if (authLoading) return;

    const seg0 = segments[0] as string | undefined;
    // revyl-auth 仅在 Revyl 测试构建中可达（REVYL_BYPASS_ENABLED 构建期内联，
    // 其他构建中该分支是死代码）；归入 auth flow 使守卫在登录成功后接管跳转。
    const inAuthFlow =
      seg0 === "sign-in" || seg0 === "auth" || (REVYL_BYPASS_ENABLED && seg0 === "revyl-auth");
    const onWelcome = seg0 === "welcome";

    if (!session && !inAuthFlow) {
      router.replace("/sign-in" as Href);
      return;
    }

    if (!session) return;

    if (prefsLoading) return;

    const needsWelcome = !prefs?.hasSeenWelcome;

    if (inAuthFlow) {
      router.replace((needsWelcome ? "/welcome" : "/(tabs)") as Href);
      return;
    }

    if (needsWelcome && !onWelcome) {
      router.replace("/welcome" as Href);
    }
  }, [session, authLoading, prefs, prefsLoading, segments, router]);

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
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="revyl-auth" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="portfolio/[id]/index" options={{ headerShown: false }} />
          <Stack.Screen
            name="portfolio/[id]/transactions/new"
            options={{
              // ADR 006 §决策六: iOS native form sheet (card-stack effect, parent edge visible).
              // Web/Android fall back to a full-screen modal automatically.
              presentation: "formSheet",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="me"
            options={{
              headerShown: false,
              animation: "slide_from_left",
              // 与 slide_from_left 配套的交互式关闭：右缘向左滑（LTR）关闭整个 me 分组；
              // 见 react-native-screens RNSScreenStack.mm（isSlideFromLeft + UIRectEdgeRight）。
              animationMatchesGesture: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="markets/search"
            options={{
              presentation: "modal",
              headerShown: false,
            }}
          />
          <Stack.Screen name="insights" options={{ headerShown: false }} />
          <Stack.Screen name="ai" options={{ headerShown: false }} />
        </Stack>
        <DevToolsFloatingOverlay />
      </View>
    </BusinessTokensProvider>
  );
}
