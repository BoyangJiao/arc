/**
 * Transaction entry stack — single unified trade form (ADR 016 v2).
 */

import { Stack } from "expo-router";

export default function TransactionEntryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: "formSheet" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="trade" />
    </Stack>
  );
}
