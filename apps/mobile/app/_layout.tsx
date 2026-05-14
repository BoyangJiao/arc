/**
 * Root layout — providers + auth-gated navigation guards.
 *
 * Provider order (outside in):
 *   GestureHandlerRootView   — RN gesture system root
 *     SafeAreaProvider       — notch / home-indicator awareness
 *       HeroUINativeProvider — HeroUI theme + portal root
 *         AuthProvider       — Supabase Auth session state (Stage 1 step 2)
 *           AppShell         — uses useAuth() + useUserPreferences() + drives BusinessTokensProvider
 *             BusinessTokensProvider — feeds gain/loss color from user prefs (Stage 1 step 5)
 *               <Stack>      — expo-router file-based routing
 *
 * Auth guard logic (in AppShell):
 *   - loading=true → render Stack as-is (Splash-equivalent; expo-router's first paint)
 *   - signed out + currently inside protected route → redirect to /sign-in
 *   - signed in + currently on /sign-in or /auth/* → redirect to /
 *
 * Once Stage 1 step 4 adds (tabs) group, this auth guard can move into a
 * (tabs)/_layout.tsx for cleaner segment-based protection.
 */

import "../global.css";
import "@arc/i18n";

import { useEffect } from "react";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HeroUINativeProvider } from "heroui-native";

import { BusinessTokensProvider, DEFAULT_FINANCE_COLOR_MODE } from "@arc/ui";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { useUserPreferences } from "../src/lib/user-preferences";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </HeroUINativeProvider>
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
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // expo-router segments: ['sign-in'] | ['auth', 'callback'] | [] | future ['(tabs)', ...]
    // Cast to string because typed-routes feature narrows segment[] to known route literals;
    // we just need a stringly compare for guard logic.
    const seg0 = segments[0] as string | undefined;
    const inAuthFlow = seg0 === "sign-in" || seg0 === "auth";

    if (!session && !inAuthFlow) {
      // Logged-out user on a protected screen → bounce to sign-in.
      router.replace("/sign-in" as Href);
    } else if (session && inAuthFlow) {
      // Already signed in but somehow on the auth screen → go home.
      router.replace("/");
    }
  }, [session, loading, segments, router]);

  return (
    <BusinessTokensProvider mode={prefs?.financeColorMode ?? DEFAULT_FINANCE_COLOR_MODE}>
      <Stack screenOptions={{ headerShown: false }} />
    </BusinessTokensProvider>
  );
}
