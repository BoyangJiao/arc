/**
 * /sign-in — Email + sign-in (dual flow: OTP code primary, magic link secondary).
 *
 * Stage 1 J1 — first-time sign-up + sign-in.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Why two flows? — Magic link's deep-link round-trip is unreliable in
 * Expo Go dev because Mac browsers cannot bridge `exp://` URLs to the iOS
 * simulator. OTP code flow has no deep-link dependency: user reads a 6-digit
 * code from the email and types it in the app.
 *
 * Defaults:
 *   - Stage 1-3 (dev / Expo Go): OTP code is primary; magic link is opt-in.
 *   - Stage 4+ (standalone build with `arc://` scheme registered): magic link
 *     becomes primary, OTP stays as fallback for accessibility.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * State machine:
 *   start            — email input + 2 send buttons (code primary, link secondary)
 *      ↓ send code              ↓ send link
 *   sendingCode                 sendingLink
 *      ↓                           ↓
 *   awaitingCode                linkSent
 *      ↓ verify
 *   verifyingCode
 *      ↓ on success
 *   (AuthProvider state flips → root layout redirects)
 *
 * Errors are kept in `errorMsg` and shown inline. Network/server errors don't
 * advance the state machine.
 */

import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";

import { Button, Card, Screen, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../src/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Supabase OTP token length is configurable per project (default 6, often 8).
// We accept the range and let `verifyOtp` decide on the server.
const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 10;

type FlowState =
  | "start"
  | "sendingCode"
  | "sendingLink"
  | "awaitingCode"
  | "verifyingCode"
  | "linkSent";

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signInWithMagicLink, signInWithOtpCode, verifyOtpCode } = useAuth();

  // DEV env switcher prefills `?email=&codeSent=1` so the user lands directly
  // in the OTP code screen for the target +alias account (Real ↔ Clean swap).
  // See `.specify/feature-specs/cross-stage/real-env-dev-tools.md` §J-RE.1.
  const params = useLocalSearchParams<{ email?: string; codeSent?: string }>();
  const prefilledEmail = typeof params.email === "string" ? params.email : "";
  const prefillCodeSent = params.codeSent === "1";

  const [email, setEmail] = useState(prefilledEmail);
  const [code, setCode] = useState("");
  const [flow, setFlow] = useState<FlowState>(
    prefilledEmail && prefillCodeSent ? "awaitingCode" : "start"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Update if query params arrive after first render (e.g. router.replace).
  useEffect(() => {
    if (prefilledEmail && prefilledEmail !== email) {
      setEmail(prefilledEmail);
      setFlow(prefillCodeSent ? "awaitingCode" : "start");
    }
    // intentionally narrow deps — we only want to react to URL-provided email
    // (react-hooks/exhaustive-deps is not enforced in this flat config)
  }, [prefilledEmail, prefillCodeSent]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const onSendCode = async () => {
    if (!EMAIL_REGEX.test(email)) {
      setErrorMsg(t("auth.invalidEmail"));
      return;
    }
    setFlow("sendingCode");
    setErrorMsg(null);

    const { error } = await signInWithOtpCode(email);

    if (error) {
      setFlow("start");
      setErrorMsg(error.message || t("auth.sendFailed"));
    } else {
      setFlow("awaitingCode");
    }
  };

  const onSendLink = async () => {
    if (!EMAIL_REGEX.test(email)) {
      setErrorMsg(t("auth.invalidEmail"));
      return;
    }
    setFlow("sendingLink");
    setErrorMsg(null);

    // Stage 4+: this becomes `arc://auth/callback` once standalone build registers the scheme.
    const redirectTo = Linking.createURL("/auth/callback");
    const { error } = await signInWithMagicLink(email, redirectTo);

    if (error) {
      setFlow("start");
      setErrorMsg(error.message || t("auth.sendFailed"));
    } else {
      setFlow("linkSent");
    }
  };

  const onVerifyCode = async () => {
    if (code.length < OTP_MIN_LENGTH || code.length > OTP_MAX_LENGTH || !/^\d+$/.test(code)) {
      setErrorMsg(t("auth.invalidCode"));
      return;
    }
    setFlow("verifyingCode");
    setErrorMsg(null);

    const { error } = await verifyOtpCode(email, code);

    if (error) {
      setFlow("awaitingCode");
      setErrorMsg(error.message || t("auth.verifyFailed"));
    }
    // On success: AuthProvider sees session → root layout redirects.
  };

  const onBackToStart = () => {
    setFlow("start");
    setCode("");
    setErrorMsg(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
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

        {flow === "awaitingCode" || flow === "verifyingCode" ? (
          <CodeInputCard
            email={email}
            code={code}
            onChangeCode={setCode}
            onVerify={onVerifyCode}
            onBack={onBackToStart}
            isVerifying={flow === "verifyingCode"}
            errorMsg={errorMsg}
            t={t}
          />
        ) : flow === "linkSent" ? (
          <LinkSentCard email={email} onBack={onBackToStart} t={t} />
        ) : (
          <StartCard
            email={email}
            onChangeEmail={setEmail}
            onSendCode={onSendCode}
            onSendLink={onSendLink}
            isSendingCode={flow === "sendingCode"}
            isSendingLink={flow === "sendingLink"}
            errorMsg={errorMsg}
            t={t}
          />
        )}

        <Text className="text-muted text-xs text-center">{t("common.notInvestmentAdvice")}</Text>
      </Screen>
    </>
  );
}

// ── Sub-views (kept inline since this screen is the only consumer) ─────────

interface I18nT {
  (key: string, opts?: Record<string, string>): string;
}

function StartCard({
  email,
  onChangeEmail,
  onSendCode,
  onSendLink,
  isSendingCode,
  isSendingLink,
  errorMsg,
  t,
}: {
  email: string;
  onChangeEmail: (v: string) => void;
  onSendCode: () => void;
  onSendLink: () => void;
  isSendingCode: boolean;
  isSendingLink: boolean;
  errorMsg: string | null;
  t: I18nT;
}) {
  const busy = isSendingCode || isSendingLink;
  return (
    <Card>
      <View className="p-4 gap-3">
        <Text className="text-foreground">{t("auth.emailLabel")}</Text>
        <TextInput
          value={email}
          onChangeText={onChangeEmail}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          inputMode="email"
          keyboardType="email-address"
          placeholder={t("auth.emailPlaceholder")}
          editable={!busy}
          // Stage 1 step 4 backlog: replace with HeroUI <TextField/> primitive.
          // Until then, set explicit fontSize + lineHeight via style to avoid
          // iOS's quirky default placeholder spacing.
          style={{ fontSize: 16, lineHeight: 22 }}
          className="bg-field text-field-foreground rounded-md px-3 py-3 border border-field-border"
        />
        {errorMsg ? <Text className="text-danger">{errorMsg}</Text> : null}
        <Button onPress={onSendCode} isDisabled={busy}>
          <Button.Label>{isSendingCode ? t("auth.sending") : t("auth.sendCode")}</Button.Label>
        </Button>
        <Button variant="ghost" onPress={onSendLink} isDisabled={busy}>
          <Button.Label>{isSendingLink ? t("auth.sending") : t("auth.sendLink")}</Button.Label>
        </Button>
      </View>
    </Card>
  );
}

function CodeInputCard({
  email,
  code,
  onChangeCode,
  onVerify,
  onBack,
  isVerifying,
  errorMsg,
  t,
}: {
  email: string;
  code: string;
  onChangeCode: (v: string) => void;
  onVerify: () => void;
  onBack: () => void;
  isVerifying: boolean;
  errorMsg: string | null;
  t: I18nT;
}) {
  return (
    <Card>
      <View className="p-4 gap-3">
        <Text className="text-foreground text-lg font-semibold">{t("auth.codeSentTitle")}</Text>
        <Text className="text-muted">{t("auth.codeSentBody", { email })}</Text>

        <Text className="text-foreground">{t("auth.codeLabel")}</Text>
        <TextInput
          value={code}
          onChangeText={(v) => onChangeCode(v.replace(/\D/g, "").slice(0, OTP_MAX_LENGTH))}
          autoCapitalize="none"
          autoComplete="one-time-code"
          autoCorrect={false}
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={OTP_MAX_LENGTH}
          placeholder={t("auth.codePlaceholder")}
          editable={!isVerifying}
          // Stage 1 step 4 backlog: replace with HeroUI <OtpInput/> primitive.
          style={{ fontSize: 24, lineHeight: 32, letterSpacing: 4, textAlign: "center" }}
          className="bg-field text-field-foreground rounded-md px-3 py-3 border border-field-border"
        />
        {errorMsg ? <Text className="text-danger">{errorMsg}</Text> : null}
        <Button onPress={onVerify} isDisabled={isVerifying || code.length < OTP_MIN_LENGTH}>
          <Button.Label>{isVerifying ? t("auth.verifying") : t("auth.verify")}</Button.Label>
        </Button>
        <Button variant="ghost" onPress={onBack} isDisabled={isVerifying}>
          <Button.Label>{t("auth.resend")}</Button.Label>
        </Button>
      </View>
    </Card>
  );
}

function LinkSentCard({ email, onBack, t }: { email: string; onBack: () => void; t: I18nT }) {
  return (
    <Card>
      <View className="p-4 gap-3">
        <Text className="text-foreground text-lg font-semibold">{t("auth.linkSentTitle")}</Text>
        <Text className="text-muted">{t("auth.linkSentBody", { email })}</Text>
        <Button variant="ghost" onPress={onBack}>
          <Button.Label>{t("auth.backToCode")}</Button.Label>
        </Button>
      </View>
    </Card>
  );
}
