import Svg, { Circle, Path } from "react-native-svg";
import { Text, View } from "react-native";
import { colors, fonts } from "../lib/theme";

/** Searchlight mark: a "G" with an arrow homing in on the centre, inside a green crosshair. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M47.6 16.4A22 22 0 1 0 54 32H37" stroke={colors.text} strokeWidth={8} />
      <Path d="M38 24.5 25 32l13 7.5Z" fill={colors.text} />
      <Circle cx={32} cy={32} r={12.5} stroke={colors.signal} strokeWidth={3} />
      <Path d="M32 2v15M32 47v15M2 32h15" stroke={colors.signal} strokeWidth={3} />
    </Svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Logo size={size} />
      <Text style={{ color: colors.text, fontSize: size * 0.68, fontFamily: fonts.light, letterSpacing: 0.8 }}>
        GRAIL<Text style={{ fontFamily: fonts.heavy }}>FINDR</Text>
      </Text>
    </View>
  );
}
