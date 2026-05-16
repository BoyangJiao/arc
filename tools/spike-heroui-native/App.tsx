import "./global.css";

import { StatusBar } from "expo-status-bar";
import { ScrollView, View, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { HeroUINativeProvider, Button, Card, Switch } from "heroui-native";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: "600" }}>
                HeroUI Native — Web compat spike
              </Text>

              <Card>
                <View style={{ padding: 16, gap: 12 }}>
                  <Text>Card body</Text>
                  <Button>Primary button</Button>
                  <Switch defaultSelected />
                </View>
              </Card>

              <Button variant="ghost">Ghost button</Button>
            </ScrollView>
            <StatusBar style="auto" />
          </SafeAreaView>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
