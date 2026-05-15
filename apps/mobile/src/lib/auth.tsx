/**
 * Auth state Provider + useAuth() hook.
 *
 * Owns the single source of truth for "who is currently signed in".
 * Wraps Supabase JS's auth state machine in a React-friendly Context.
 *
 * Usage:
 *   <AuthProvider>...</AuthProvider>  (in app/_layout.tsx)
 *   const { session, user, loading, signOut } = useAuth();
 *
 * Behaviour:
 *   - On mount: reads cached session from AsyncStorage (Supabase SDK does this automatically)
 *   - Subscribes to onAuthStateChange so route guards rerender on sign-in / sign-out
 *   - `loading=true` until first session restore completes — gates layout redirects
 *
 * ADR 007: No DEV bypass. Dev期间靠 AsyncStorage 持久化 + 60d refresh token，
 * 登录一次顶 60 天，不需要绕开 auth 链路。
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /**
   * Magic link flow — Stage 4 production path. Email contains a clickable link
   * that opens the app via deep link. Stage 1 dev with Expo Go is brittle here
   * (Mac Safari can't bridge to sim), so prefer signInWithOtpCode in dev.
   */
  signInWithMagicLink: (email: string, redirectTo: string) => Promise<{ error: Error | null }>;
  /**
   * 6-digit OTP code flow — Stage 1 dev path. Email contains a code; user types
   * it back into the app. No deep link needed; works in Expo Go + Mac browser.
   */
  signInWithOtpCode: (email: string) => Promise<{ error: Error | null }>;
  /** Verify the 6-digit code the user typed in. */
  verifyOtpCode: (email: string, token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore cached session on cold start.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
      })
      .finally(() => {
        setLoading(false);
      });

    // React to sign-in / sign-out / token refresh.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signInWithMagicLink: async (email, redirectTo) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo,
            shouldCreateUser: true,
          },
        });
        return { error: error ?? null };
      },
      signInWithOtpCode: async (email) => {
        // Omitting emailRedirectTo triggers Supabase to send the OTP email
        // template (with `{{ .Token }}`) instead of the magic-link template.
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
          },
        });
        return { error: error ?? null };
      },
      verifyOtpCode: async (email, token) => {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: "email",
        });
        return { error: error ?? null };
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        return { error: error ?? null };
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
