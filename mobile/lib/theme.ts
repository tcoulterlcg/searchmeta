import { StyleSheet } from "react-native";

export const fonts = {
  light: "BricolageGrotesque_300Light",
  bold: "BricolageGrotesque_700Bold",
  heavy: "BricolageGrotesque_800ExtraBold",
};

export const colors = {
  ink: "#0b0d10",
  panel: "#13161b",
  line: "#232830",
  muted: "#8a94a3",
  text: "#e8ecf1",
  signal: "#3ef08a",
  signalDim: "#1f7a47",
  warn: "#ffb547",
  danger: "#f87171",
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  pad: { paddingHorizontal: 16 },
  h1: { color: colors.text, fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.5 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 14 },
  btn: { backgroundColor: colors.signal, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  btnText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  btnGhost: { borderColor: colors.line, borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  btnGhostText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { borderColor: colors.signal, backgroundColor: "rgba(62,240,138,0.1)" },
  chipText: { color: colors.muted, fontSize: 14 },
  chipTextOn: { color: colors.signal },
});
