import { View, ScrollView } from "react-native";
import { useState } from "react";
import { Button, Card, Switch, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

export default function HomeScreen() {
  const { t } = useTranslation();
  const [dark, setDark] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, gap: 16 }}
      className="flex-1 bg-background"
    >
      <Text className="text-2xl font-semibold">{t("common.appName")}</Text>

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
    </ScrollView>
  );
}
