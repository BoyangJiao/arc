/**
 * me/settings.tsx — Settings page
 *
 * Per IA v2.2 §四:
 * - Reporting currency (CNY / USD)
 * - Language (zh / en)
 * - Red up green down toggle (finance color mode)
 * - Dark / Light mode
 * - Side effect: all pages re-render immediately on change
 *
 * Uses useUserPreferences() to persist to Supabase.
 * financeColorMode drives BusinessTokensProvider in root _layout.
 */

import { Pressable, View } from "react-native";
import { Stack } from "expo-router";
import { Switch, Screen, Text, useFinanceColorMode, useStackScreenOptions } from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import i18n from "@arc/i18n";
import type { FinanceColorMode, Currency, Locale } from "@arc/core";

import { useMarketDataPolicyStore } from "../../src/lib/market-data";
import { useUserPreferences } from "../../src/lib/user-preferences";
import { useColorMode } from "../../src/lib/theme";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { prefs, update } = useUserPreferences();
  const { colorMode, toggleColorMode } = useColorMode();
  const { financeColorMode, setFinanceColorMode } = useFinanceColorMode();
  const useRealMarketData = useMarketDataPolicyStore((s) => s.useRealMarketData);
  const setUseRealMarketData = useMarketDataPolicyStore((s) => s.setUseRealMarketData);

  const isDark = colorMode === "dark";

  const isRedUp = financeColorMode === "redUpGreenDown";
  const isCNY = prefs?.reportingCurrency === "CNY";
  const currentLocale = i18n.language;
  const isZh = currentLocale === "zh";

  const handleColorModeToggle = (selected: boolean) => {
    const mode: FinanceColorMode = selected ? "redUpGreenDown" : "greenUpRedDown";
    setFinanceColorMode(mode);
    update({ financeColorMode: mode });
  };

  const handleCurrencyToggle = () => {
    const currency: Currency = isCNY ? "USD" : "CNY";
    update({ reportingCurrency: currency });
  };

  const handleLanguageToggle = () => {
    const locale: Locale = isZh ? "en" : "zh";
    update({ locale });
    i18n.changeLanguage(locale);
  };

  const screenOptions = useStackScreenOptions({
    title: t("settings.title"),
    backType: "chevron",
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        <View className="gap-4">
          {/* Reporting Currency */}
          <Pressable onPress={handleCurrencyToggle}>
            <View className="flex-row items-center justify-between bg-surface px-4 py-4 rounded-xl">
              <Text className="text-foreground text-base">{t("settings.reportingCurrency")}</Text>
              <Text className="text-accent font-semibold">{isCNY ? "CNY ¥" : "USD $"}</Text>
            </View>
          </Pressable>

          {/* Language */}
          <Pressable onPress={handleLanguageToggle}>
            <View className="flex-row items-center justify-between bg-surface px-4 py-4 rounded-xl">
              <Text className="text-foreground text-base">{t("settings.language")}</Text>
              <Text className="text-accent font-semibold">
                {isZh ? t("settings.languageZh") : t("settings.languageEn")}
              </Text>
            </View>
          </Pressable>

          {/* Finance Color Mode — Red up / Green up */}
          <View className="flex-row items-center justify-between bg-surface px-4 py-4 rounded-xl">
            <View className="flex-1 mr-4">
              <Text className="text-foreground text-base">{t("settings.financeColorMode")}</Text>
              <Text className="text-muted text-xs mt-1">
                {isRedUp ? t("settings.redUpGreenDown") : t("settings.greenUpRedDown")}
              </Text>
            </View>
            <Switch isSelected={isRedUp} onSelectedChange={handleColorModeToggle} />
          </View>

          {/* Dark mode — functional toggle */}
          <View className="flex-row items-center justify-between bg-surface px-4 py-4 rounded-xl">
            <Text className="text-foreground text-base">{t("settings.darkMode")}</Text>
            <Switch isSelected={isDark} onSelectedChange={toggleColorMode} />
          </View>

          {/* Dev-only: market data policy toggle (ADR 008) */}
          {__DEV__ && (
            <View className="mt-6 gap-2">
              <Text className="text-muted text-xs uppercase tracking-wide px-1">
                {t("settings.devOnlyHeader")}
              </Text>
              <View className="flex-row items-center justify-between bg-surface px-4 py-4 rounded-xl">
                <View className="flex-1 mr-4">
                  <Text className="text-foreground text-base">
                    {t("settings.useRealMarketData")}
                  </Text>
                  <Text className="text-muted text-xs mt-1">
                    {useRealMarketData
                      ? t("settings.useRealMarketDataOnHint")
                      : t("settings.useRealMarketDataOffHint")}
                  </Text>
                </View>
                <Switch isSelected={useRealMarketData} onSelectedChange={setUseRealMarketData} />
              </View>
            </View>
          )}
        </View>
      </Screen>
    </>
  );
}
