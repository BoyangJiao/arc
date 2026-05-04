import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Text className="text-white text-2xl font-bold">{t("common.appName")}</Text>
      <Text className="text-neutral-400 text-sm mt-2">{t("common.notInvestmentAdvice")}</Text>
    </View>
  );
}
