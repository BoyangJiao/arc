/**
 * Transaction entry stack — mode picker → trade | snapshot (ADR 016).
 */

import { Stack } from "expo-router";

export default function TransactionEntryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: "formSheet" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="trade" />
      <Stack.Screen name="snapshot" />
    </Stack>
  );
}
