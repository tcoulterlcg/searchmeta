import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../lib/theme";

const ICONS = {
  bell: "M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Zm-2 16a2 2 0 0 0 4 0",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-6v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1",
};

function Icon({ d, color }: { d: string; color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Alerts", tabBarIcon: ({ color }) => <Icon d={ICONS.bell} color={color} /> }} />
      <Tabs.Screen name="searches" options={{ title: "Searches", tabBarIcon: ({ color }) => <Icon d={ICONS.search} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <Icon d={ICONS.gear} color={color} /> }} />
    </Tabs>
  );
}
