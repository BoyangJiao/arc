/**
 * /sign-in — Email + magic link entry point.
 *
 * Stage 1 J1 (first-time sign-up + sign-in via Supabase Auth magic link).
 *
 * Flow:
 *   1. User enters email
 *   2. Tap "Send link" → supabase.auth.signInWithOtp(...) with PKCE flow.
 *      Supabase emails a link `https://<project>.supabase.co/auth/v1/verify?...&redirect_to=arc://auth/callback`.
 *   3. UI flips to "Check your email" success state with a resend option.
 *   4. User taps the email link → opens app via deep link (scheme `arc`).
 *   5. app/auth/callback.tsx exchanges the code for a session.
 *   6. AuthProvider state flips → root layout redirects to /(tabs)/index.
 *
 * Stage 1 expedient: raw RN TextInput. Stage 1 step 4 swaps to HeroUI <TextField>
 * primitive once that ships.
 */

import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";

import { Button, Card, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../src/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSend = async () => {
    if (!EMAIL_REGEX.test(email)) {
      setStatus("error");
      setErrorMsg(t("auth.invalidEmail"));
      return;
    }

    setStatus("sending");
    setErrorMsg(null);

    // createURL with no path → app's base URL
    //   - prod: `arc://...`
    //   - Expo Go dev: `exp://192.168.x.x:8081/--/auth/callback`
    // Path "/auth/callback" routes to app/auth/callback.tsx via expo-router.
    const redirectTo = Linking.createURL("/auth/callback");

    const { error } = await signInWithMagicLink(email, redirectTo);

    if (error) {
      setStatus("error");
      setErrorMsg(error.message || t("auth.sendFailed"));
    } else {
      setStatus("sent");
    }
  };

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
        <View className="gap-2">
          <Text className="text-3xl font-semibold text-foreground">{t("auth.welcomeTitle")}</Text>
          <Text className="text-muted">{t("auth.welcomeSubtitle")}</Text>
        </View>

        {status === "sent" ? (
          <Card>
            <View className="p-4 gap-3">
              <Text className="text-foreground text-lg font-semibold">{t("auth.sentTitle")}</Text>
              <Text className="text-muted">{t("auth.sentBody", { email })}</Text>
              <Button
                variant="ghost"
                onPress={() => {
                  setStatus("idle");
                  setErrorMsg(null);
                }}
              >
                <Button.Label>{t("auth.resend")}</Button.Label>
              </Button>
            </View>
          </Card>
        ) : (
          <Card>
            <View className="p-4 gap-3">
              <Text className="text-foreground">{t("auth.emailLabel")}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                inputMode="email"
                keyboardType="email-address"
                placeholder={t("auth.emailPlaceholder")}
                className="bg-field text-field-foreground rounded-md px-3 py-2 border border-field-border"
              />
              {status === "error" && errorMsg ? (
                <Text className="text-danger">{errorMsg}</Text>
              ) : null}
              <Button onPress={onSend} isDisabled={status === "sending"}>
                <Button.Label>
                  {status === "sending" ? t("auth.sending") : t("auth.sendLink")}
                </Button.Label>
              </Button>
            </View>
          </Card>
        )}

        <Text className="text-muted text-xs text-center">{t("common.notInvestmentAdvice")}</Text>
      </ScrollView>
    </>
  );
}
