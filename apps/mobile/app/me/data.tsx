/**
 * me/data.tsx — 数据管理二级页面
 *
 * 导出数据 + 导入数据两个入口，从 Me 页面的「数据管理」点击进入。
 */

import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  InScreenHeader,
  ListGroup,
  PressableFeedback,
  Screen,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

export default function DataScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("data.title")} leftType="back" />

      <View className="mt-4">
        <ListGroup>
          <PressableFeedback animation={false} onPress={() => router.push("/me/export" as Href)}>
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("export.entryTitle")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>
          <PressableFeedback animation={false} onPress={() => router.push("/me/import" as Href)}>
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("import.entryTitle")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>
        </ListGroup>
      </View>
    </Screen>
  );
}
