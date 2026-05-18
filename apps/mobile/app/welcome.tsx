/**
 * /welcome — First-launch orientation (J6, Stage 2).
 *
 * Single screen; Stage 5 may replace with multi-step onboarding.
 * CTA / Skip mark welcome seen then land on Portfolio Tab (no FAB pre-open).
 */

import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Button, Screen, Sparkles, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useMarkWelcomeSeen, useUserPreferences } from "../src/lib/user-preferences";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { prefs, loading } = useUserPreferences();
  const markWelcomeSeen = useMarkWelcomeSeen();

  useEffect(() => {
    if (loading) return;
    if (prefs?.hasSeenWelcome) {
      router.replace("/(tabs)" as Href);
    }
  }, [loading, prefs?.hasSeenWelcome, router]);

  const finish = () => {
    markWelcomeSeen.mutate();
    router.replace("/(tabs)" as Href);
  };

  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center px-6 gap-8">
        <View className="items-center gap-4">
          <Sparkles size={56} className="text-accent" accessibilityLabel="" />
          <Text className="text-foreground text-2xl font-bold text-center">
            {t("welcome.title")}
          </Text>
          <View className="gap-2">
            {t("welcome.body1")
              .split("\n")
              .map((line) => (
                <Text key={line} className="text-muted text-sm text-center">
                  {line}
                </Text>
              ))}
            <Text className="text-muted text-sm text-center">{t("welcome.body2")}</Text>
          </View>
          <Text className="text-muted-foreground text-xs text-center">
            {t("welcome.disclaimer")}
          </Text>
        </View>

        <View className="gap-4">
          <Button className="w-full" onPress={finish}>
            <Button.Label>{t("welcome.primaryCta")}</Button.Label>
          </Button>
          <Pressable onPress={finish} className="self-center active:opacity-70" hitSlop={8}>
            <Text className="text-accent text-sm">{t("welcome.skip")}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
