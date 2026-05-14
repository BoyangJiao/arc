import { ScrollView, View } from "react-native";
import { useState } from "react";
import { Button, Card, Switch, Text, useBusinessClasses } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../src/lib/auth";

/**
 * Temporary home — Stage 1 step 2 only proves the auth round-trip + token system.
 * Stage 1 step 4 replaces this with the real Portfolio Tab (per IA v2.2 §四).
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const businessClasses = useBusinessClasses();
  const [dark, setDark] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} className="flex-1 bg-background">
      <Text className="text-2xl font-semibold">{t("common.appName")}</Text>

      {user ? <Text className="text-muted text-xs">{user.email}</Text> : null}

      <Card>
        <View className="p-4 gap-3">
          <Text>{t("debug.heroUiTitle")}</Text>
          <Button>
            <Button.Label>{t("common.appName")}</Button.Label>
          </Button>
          <View className="flex-row items-center gap-2">
            <Switch isSelected={dark} onSelectedChange={setDark} />
            <Text>{t("settings.darkMode")}</Text>
          </View>
        </View>
      </Card>

      {/* Business token visual sanity check */}
      <Card>
        <View className="p-4 gap-3">
          <Text className="text-foreground font-semibold">PnL Preview</Text>
          <View className="flex-row gap-3">
            <View className={`${businessClasses.gain.bgSoft} px-3 py-1 rounded-md`}>
              <Text className={businessClasses.gain.text}>+2.34%</Text>
            </View>
            <View className={`${businessClasses.loss.bgSoft} px-3 py-1 rounded-md`}>
              <Text className={businessClasses.loss.text}>-1.20%</Text>
            </View>
            <Text className={businessClasses.pnlNeutral.text}>0.00%</Text>
          </View>
        </View>
      </Card>

      {user ? (
        <Button variant="ghost" onPress={() => signOut()}>
          <Button.Label>{t("auth.signOut")}</Button.Label>
        </Button>
      ) : null}
    </ScrollView>
  );
}
