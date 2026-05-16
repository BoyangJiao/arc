/**
 * me/index.tsx — Me full-screen page
 *
 * Per IA v2.2 §3.4 + §四:
 * - Full-screen design, slides in from left (animation set in root _layout)
 * - Contains: gradient avatar + email + settings link + sign out
 * - Stage 1: only Settings and Sign out
 * - Stage 3+: adds Subscription, Inbox, Connection Management
 *
 * Fix 6b:
 * - Handrolled "first-letter circle" replaced with <UserAvatar> (ADR 004 dicebear)
 * - Text "→" arrow replaced with Lucide ChevronRight (matches app-wide icon set)
 * - Header back wires via useStackScreenOptions (ADR 006 §决策五 atoms)
 */

import { Pressable, View } from "react-native";
import { useRouter, Stack, type Href } from "expo-router";
import { Button, ChevronRight, Screen, Text, UserAvatar, useStackScreenOptions } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../../src/lib/auth";

export default function MeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const screenOptions = useStackScreenOptions({
    title: t("me.title"),
    backType: "chevron",
  });

  const handleSignOut = async () => {
    await signOut();
    // Auth guard in root layout will redirect to /sign-in; this is belt-and-suspenders.
    router.replace("/sign-in" as Href);
  };

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        {/* Profile section — gradient avatar (ADR 004) + email */}
        <View className="items-center py-8">
          <UserAvatar seed={user?.email} size={80} className="mb-4" />
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
              <ChevronRight size={20} className="text-muted" />
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
