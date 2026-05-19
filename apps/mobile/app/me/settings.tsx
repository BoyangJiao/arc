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

import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  InScreenHeader,
  ListGroup,
  PressableFeedback,
  Screen,
  Separator,
  Switch,
  Text,
  scrollContentBelowInScreenHeader,
  useFinanceColorMode,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import i18n from "@arc/i18n";
import type { FinanceColorMode, Currency, Locale } from "@arc/core";

import { useUserPreferences } from "../../src/lib/user-preferences";
import { useColorMode } from "../../src/lib/theme";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { prefs, update } = useUserPreferences();
  const { colorMode, toggleColorMode } = useColorMode();
  const { financeColorMode, setFinanceColorMode } = useFinanceColorMode();
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

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("settings.title")} leftType="back" />
      <View className="gap-4">
        <ListGroup>
          <PressableFeedback animation={false} onPress={handleCurrencyToggle}>
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("settings.reportingCurrency")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Text className="text-foreground font-semibold">{isCNY ? "CNY ¥" : "USD $"}</Text>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>

          <Separator className="mx-4" />

          <PressableFeedback animation={false} onPress={handleLanguageToggle}>
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("settings.language")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Text className="text-foreground font-semibold">
                    {isZh ? t("settings.languageZh") : t("settings.languageEn")}
                  </Text>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>

          <Separator className="mx-4" />

          <ListGroup.Item>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>{t("settings.financeColorMode")}</ListGroup.ItemTitle>
              <ListGroup.ItemDescription>
                {isRedUp ? t("settings.redUpGreenDown") : t("settings.greenUpRedDown")}
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix>
              <Switch isSelected={isRedUp} onSelectedChange={handleColorModeToggle} />
            </ListGroup.ItemSuffix>
          </ListGroup.Item>

          <Separator className="mx-4" />

          <ListGroup.Item>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>{t("settings.darkMode")}</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix>
              <Switch isSelected={isDark} onSelectedChange={toggleColorMode} />
            </ListGroup.ItemSuffix>
          </ListGroup.Item>

          <Separator className="mx-4" />

          <PressableFeedback
            animation={false}
            onPress={() => router.push("/me/cash-balances" as Href)}
          >
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("rebalance.cashBalancesTitle")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>
        </ListGroup>

        {__DEV__ && (
          <View className="mt-6 gap-2">
            <Text className="text-muted text-xs uppercase tracking-wide px-1">
              {t("settings.devOnlyHeader")}
            </Text>
            <ListGroup>
              <PressableFeedback
                animation={false}
                onPress={() => router.push("/me/dev-tools" as Href)}
              >
                <PressableFeedback.Scale>
                  <ListGroup.Item disabled>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>{t("settings.openDevTools")}</ListGroup.ItemTitle>
                      <ListGroup.ItemDescription>
                        {t("settings.openDevToolsHint")}
                      </ListGroup.ItemDescription>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix />
                  </ListGroup.Item>
                </PressableFeedback.Scale>
                <PressableFeedback.Ripple />
              </PressableFeedback>
            </ListGroup>
          </View>
        )}
      </View>
    </Screen>
  );
}
