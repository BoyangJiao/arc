import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Text className="text-white text-2xl font-bold">Arc</Text>
      <Text className="text-neutral-400 text-sm mt-2">循迹</Text>
    </View>
  );
}
