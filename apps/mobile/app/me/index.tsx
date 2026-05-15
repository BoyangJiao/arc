/**
 * me/index.tsx — Me full-screen page
 *
 * Per IA v2.2 §3.4 + §四:
 * - Full-screen design, slides in from left (animation set in root _layout)
 * - Contains: gradient avatar + email + settings link + sign out
 * - Stage 1: only Settings and Sign out
 * - Stage 3+: adds Subscription, Inbox, Connection Management
 */

import { Pressable, View } from "react-native";
import { useRouter, Stack, type Href } from "expo-router";
import { Button, Screen, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../../src/lib/auth";

export default function MeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/sign-in" as Href);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("me.title"),
          headerBackTitle: t("common.close"),
          animation: "slide_from_left",
        }}
      />
      <Screen>
        {/* Profile section — avatar + email */}
        <View className="items-center py-8">
          <View className="w-20 h-20 rounded-full bg-accent items-center justify-center mb-4">
            <Text className="text-accent-foreground text-2xl font-bold">
              {user?.email?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text className="text-foreground text-lg font-medium">{user?.email ?? ""}</Text>
        </View>

        {/* Menu items */}
        <View className="gap-2 mt-4">
          {/* Settings */}
          <Pressable
            onPress={() => router.push("/me/settings" as Href)}
            className="active:opacity-70"
          >
            <View className="flex-row items-center justify-between bg-surface px-4 py-4 rounded-xl">
              <Text className="text-foreground text-base">{t("me.settings")}</Text>
              <Text className="text-muted">→</Text>
            </View>
          </Pressable>

          {/* Sign out */}
          <View className="mt-8">
            <Button variant="ghost" onPress={handleSignOut}>
              <Button.Label>{t("me.signOut")}</Button.Label>
            </Button>
          </View>
        </View>
      </Screen>
    </>
  );
}
