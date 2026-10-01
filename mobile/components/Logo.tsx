import Svg, { Circle, Path } from "react-native-svg";
import { Text, View } from "react-native";
import { colors } from "../lib/theme";

/** Converge mark: four sources flowing into one alert. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M8 12C28 12 26 32 44 32" stroke={colors.text} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M8 25C24 25 28 32 44 32" stroke={colors.text} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M8 39C24 39 28 32 44 32" stroke={colors.text} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M8 52C28 52 26 32 44 32" stroke={colors.text} strokeWidth={4.5} strokeLinecap="round" />
      <Circle cx={50} cy={32} r={9} fill={colors.signal} />
    </Svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Logo size={size} />
      <Text style={{ color: colors.text, fontSize: size * 0.72, fontWeight: "300", letterSpacing: -0.5 }}>
        search<Text style={{ fontWeight: "800" }}>meta</Text>
      </Text>
    </View>
  );
}
