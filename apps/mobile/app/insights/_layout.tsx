import { Stack } from "expo-router";

export default function InsightsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="rebalance/setup"
        options={{
          presentation: "modal",
          headerShown: true,
        }}
      />
      <Stack.Screen name="rebalance/actions" />
    </Stack>
  );
}
