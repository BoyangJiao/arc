/**
 * /revyl-auth — Revyl auth-bypass 的 Expo Router backstop route。
 *
 * `arc://revyl-auth?email=...&password=...` 由 Expo Router 原生解析到本路由；
 * 处理逻辑全部在 src/lib/revyl-auth-bypass.ts（构建期门禁 + allowlist + 真实登录）。
 *
 * 登录成功后不在此处导航 —— root layout 的路由守卫检测到 session 出现，
 * 会按正常逻辑跳 /welcome 或 /(tabs)（与人工登录后的行为完全一致）。
 * 拒绝时把原因可见地渲染出来，云设备截图即可诊断（Revyl skill 的要求）。
 */

import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { performRevylBypassSignIn, type RevylBypassResult } from "../src/lib/revyl-auth-bypass";

export default function RevylAuthScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string; password?: string }>();
  const [result, setResult] = useState<RevylBypassResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void performRevylBypassSignIn(params).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
    // 仅按凭据参数重跑（params 对象引用每次渲染都会变，不能作依赖）。
  }, [params.email, params.password]);

  const statusText =
    result === null
      ? t("revylAuth.signingIn")
      : result.status === "signed_in"
        ? t("revylAuth.success")
        : t(`revylAuth.rejected.${result.reason}` as "revylAuth.rejected.disabled");

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text className="text-foreground text-lg font-semibold">{t("revylAuth.title")}</Text>
        <Text className="text-muted text-sm text-center" testID="revyl-auth-status">
          {statusText}
        </Text>
      </View>
    </Screen>
  );
}
