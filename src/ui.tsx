import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import { createButton } from "@gluestack-ui/core/button/creator";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
const GButton = createButton({
  Root: Pressable,
  Text,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: Feather,
});
export const C = {
  paper: "#f7f8f2",
  ink: "#233b32",
  muted: "#7a857d",
  green: "#387968",
  pale: "#e8eee5",
  line: "#e3e8df",
  white: "#fff",
  orange: "#bf875e",
};
export const Icon = ({
  name,
  size = 21,
  color = C.ink,
}: {
  name: any;
  size?: number;
  color?: string;
}) => <Feather name={name} size={size} color={color} />;
export const T = ({
  children,
  style,
  ...rest
}: React.ComponentProps<typeof Text>) => (
  <Text {...rest} style={[s.text, style]}>
    {children}
  </Text>
);
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  style,
}: React.PropsWithChildren<{
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}>) {
  return (
    <GButton
      onPress={onPress}
      isDisabled={disabled}
      accessibilityRole="button"
      style={[
        s.button,
        {
          backgroundColor: secondary ? C.pale : C.green,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <GButton.Text
        style={{
          color: secondary ? C.green : C.white,
          fontSize: 15,
          fontWeight: "600",
          letterSpacing: 0.3,
        }}
      >
        {children}
      </GButton.Text>
    </GButton>
  );
}
export const Card = ({
  children,
  style,
}: React.PropsWithChildren<{ style?: ViewStyle }>) => (
  <View style={[s.card, style]}>{children}</View>
);
export function Chip({
  children,
  active = false,
  onPress,
}: React.PropsWithChildren<{ active?: boolean; onPress?: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.chip, { backgroundColor: active ? C.green : C.pale }]}
    >
      <T
        style={{
          fontSize: 12,
          color: active ? "white" : C.green,
          fontWeight: "600",
        }}
      >
        {children}
      </T>
    </Pressable>
  );
}
export function Ring({
  value,
  total,
  size = 148,
}: {
  value: number;
  total: number;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#dce8db"
          strokeWidth={7}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={C.green}
          strokeWidth={7}
          strokeDasharray={`${len * Math.min(1, value / Math.max(total, 1))} ${len}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          fill="none"
        />
      </Svg>
      <T style={{ fontSize: 42, fontWeight: "500", letterSpacing: -2 }}>
        {value}
        <T style={{ fontSize: 16, color: C.muted, letterSpacing: 0 }}>
          {" "}
          / {total}
        </T>
      </T>
      <T style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>今日の単語</T>
    </View>
  );
}
export function Brand() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View
        style={{
          backgroundColor: C.green,
          width: 30,
          height: 30,
          borderRadius: 10,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M3 16V11C3 7 7 7 8 11C10 6 14 6 16 11L18 7V4H21V14H18L16 17H6L5 20M16 17L18 20M8 17L9 20"
            stroke="#edf3dc"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
      <T style={{ fontSize: 21, fontWeight: "700", letterSpacing: -0.6 }}>
        camelwords<T style={{ color: C.green }}>⁕</T>
      </T>
    </View>
  );
}
export const s = StyleSheet.create({
  text: { color: C.ink, fontSize: 14, lineHeight: 22 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: C.line,
    gap: 14,
  },
  button: {
    minHeight: 54,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontSize: 29,
    lineHeight: 40,
    fontWeight: "600",
    letterSpacing: -0.8,
  },
  sub: { fontSize: 13, color: C.muted },
  section: { fontSize: 17, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "white",
    fontSize: 15,
    color: C.ink,
  },
  label: { fontSize: 10, fontWeight: "600", letterSpacing: 2, color: C.green },
  link: { color: C.green, fontSize: 13, fontWeight: "600" },
  divider: { height: 1, backgroundColor: C.line },
  iconButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: C.line,
  },
});
