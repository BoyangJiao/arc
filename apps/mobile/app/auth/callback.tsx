/**
 * /auth/callback — PKCE redirect handler.
 *
 * The user lands here after tapping the magic link in email.
 * URL contains either:
 *   - `?code=...` (PKCE) — exchange via supabase.auth.exchangeCodeForSession
 *   - `#access_token=...&refresh_token=...` (legacy implicit) — supabase auto-handles
 *
 * After session is established, AuthProvider's onAuthStateChange fires;
 * root layout sees `session != null` and redirects to /(tabs)/index.
 *
 * This screen mostly shows a brief "Verifying…" loader. On error it surfaces a
 * back-to-sign-in CTA.
 */

import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams, type Href } from "expo-router";

import { Button, Card, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { supabase } from "../../src/lib/supabase";

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const exchange = async () => {
      // Surface Supabase's own error_description if present
      if (params.error_description) {
        setErrorMsg(decodeURIComponent(params.error_description));
        return;
      }

      if (!params.code) {
        setErrorMsg(t("auth.callbackFailed"));
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(params.code);

      if (cancelled) return;

      if (error) {
        setErrorMsg(error.message || t("auth.callbackFailed"));
        return;
      }

      // Success — root layout will see new session and redirect; we replace to be safe.
      router.replace("/");
    };

    void exchange();

    return () => {
      cancelled = true;
    };
  }, [params.code, params.error_description, t]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          padding: 24,
          gap: 24,
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        {errorMsg ? (
          <Card>
            <View className="p-4 gap-3">
              <Text className="text-foreground text-lg font-semibold">
                {t("auth.callbackFailed")}
              </Text>
              <Text className="text-muted">{errorMsg}</Text>
              <Button onPress={() => router.replace("/sign-in" as Href)}>
                <Button.Label>{t("auth.callbackTryAgain")}</Button.Label>
              </Button>
            </View>
          </Card>
        ) : (
          <View className="items-center gap-3">
            <Text className="text-foreground">{t("auth.callbackVerifying")}</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}
