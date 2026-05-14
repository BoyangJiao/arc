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
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithMagicLink: (email: string, redirectTo: string) => Promise<{ error: Error | null }>;
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
