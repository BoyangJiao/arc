/**
 * Supabase client singleton for the mobile app.
 *
 * - Reads URL + anon key from EXPO_PUBLIC_* env vars (statically replaced by Expo at build time)
 * - Uses AsyncStorage for session persistence (required on RN; Web ignores via runtime check)
 * - Uses PKCE flow for magic-link auth (modern, secure default)
 * - SDK auto-handles JWT refresh / session restore on cold start
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase';
 *   const { data, error } = await supabase.from('portfolios').select();
 *
 * RLS is enforced server-side based on the JWT this client carries.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // In dev we want a loud failure; in CI we want this to surface immediately
  throw new Error(
    "Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL and " +
      "EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env (see .env.example)."
  );
}

/**
 * Singleton Supabase client. Re-creating the client on every call would
 * spawn duplicate auth subscriptions / refresh timers; never do that.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // RN has no localStorage; AsyncStorage is the standard adapter.
    // Web (`react-native-web`) prefers built-in localStorage, so skip storage there.
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Mobile uses deep links (handled in app/auth/callback.tsx), not URL parsing.
    // Web uses URL hash detection, which Supabase JS handles by default — leave it on for web.
    detectSessionInUrl: Platform.OS === "web",
    // PKCE is the modern + recommended flow for SPA + RN; tokens never traverse URL.
    flowType: "pkce",
  },
});
