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
 * - Text "→" arrow replaced with Phosphor CaretRight (matches app-wide icon set)
 * - In-screen header: title centered, close on the right (no back chevron)
 */

import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Button,
  HeaderCloseButton,
  InScreenHeader,
  ListGroup,
  PressableFeedback,
  Screen,
  Text,
  UserAvatar,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../../src/lib/auth";

export default function MeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    // Auth guard in root layout will redirect to /sign-in; this is belt-and-suspenders.
    router.replace("/sign-in" as Href);
  };

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader
        title={t("me.title")}
        leftType="none"
        rightSlot={<HeaderCloseButton accessibilityLabel={t("common.close")} />}
      />
      {/* Profile section — gradient avatar (ADR 004) + email */}
      <View className="items-center py-8">
        <UserAvatar seed={user?.email} size={80} className="mb-4" />
        <Text className="text-foreground text-lg font-medium">{user?.email ?? ""}</Text>
      </View>

      <View className="mt-4">
        <ListGroup>
          <PressableFeedback
            animation={false}
            onPress={() => router.push("/me/portfolios" as Href)}
          >
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("portfolios.manage")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>
          <PressableFeedback animation={false} onPress={() => router.push("/me/inbox" as Href)}>
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("inbox.entryTitle")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>
          <PressableFeedback
            animation={false}
            onPress={() => router.push("/me/subscription" as Href)}
          >
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("subscription.title")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>
          <PressableFeedback animation={false} onPress={() => router.push("/me/settings" as Href)}>
            <PressableFeedback.Scale>
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t("me.settings")}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </PressableFeedback.Scale>
            <PressableFeedback.Ripple />
          </PressableFeedback>
        </ListGroup>

        <View className="mt-8">
          <Button variant="ghost" onPress={handleSignOut}>
            <Button.Label>{t("me.signOut")}</Button.Label>
          </Button>
        </View>
      </View>
    </Screen>
  );
}
