import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";

import { rabbehniTokens } from "./tokens.js";

export function NativeAurora({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <LinearGradient
      colors={["#071012", "#10262b", "#161a2f"]}
      locations={[0, 0.52, 1]}
      style={nativeStyles.aurora}
    >
      <View style={[nativeStyles.orb, nativeStyles.orbMint]} />
      <View style={[nativeStyles.orb, nativeStyles.orbViolet]} />
      {children}
    </LinearGradient>
  );
}

export function NativeGlassCard({
  children,
  style,
}: Readonly<{ children: ReactNode; style?: ViewStyle }>) {
  return (
    <BlurView intensity={42} tint="dark" style={[nativeStyles.glass, style]}>
      {children}
    </BlurView>
  );
}

export function NativeMark() {
  return (
    <View style={nativeStyles.brand}>
      <View style={nativeStyles.mark}>
        <View style={[nativeStyles.markLeaf, nativeStyles.markLeafOne]} />
        <View style={[nativeStyles.markLeaf, nativeStyles.markLeafTwo]} />
        <View style={[nativeStyles.markLeaf, nativeStyles.markLeafThree]} />
      </View>
      <Text style={nativeStyles.brandText}>Rabbehni</Text>
    </View>
  );
}

export function NativeButton({
  children,
  disabled,
  onPress,
  variant = "primary",
}: Readonly<{
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  variant?: "primary" | "secondary";
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        nativeStyles.button,
        variant === "secondary" && nativeStyles.buttonSecondary,
        pressed && nativeStyles.buttonPressed,
        disabled && nativeStyles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          nativeStyles.buttonText,
          variant === "secondary" && nativeStyles.buttonSecondaryText,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function NativeField({ label, ...props }: Readonly<TextInputProps & { label: string }>) {
  return (
    <View style={nativeStyles.field}>
      <Text style={nativeStyles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        placeholderTextColor="rgba(232,244,241,.42)"
        style={nativeStyles.input}
        {...props}
      />
    </View>
  );
}

export const nativeStyles = StyleSheet.create({
  aurora: {
    flex: 1,
    overflow: "hidden",
    padding: rabbehniTokens.space.lg,
  },
  orb: {
    borderRadius: 999,
    height: 280,
    opacity: 0.2,
    position: "absolute",
    width: 280,
  },
  orbMint: {
    backgroundColor: rabbehniTokens.color.mint,
    right: -120,
    top: -70,
  },
  orbViolet: {
    backgroundColor: rabbehniTokens.color.violet,
    bottom: 30,
    left: -160,
  },
  glass: {
    backgroundColor: "rgba(255,255,255,.08)",
    borderColor: "rgba(255,255,255,.17)",
    borderRadius: rabbehniTokens.radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    padding: rabbehniTokens.space.lg,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  brandText: {
    color: "#f4fbf8",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  mark: {
    height: 30,
    position: "relative",
    width: 30,
  },
  markLeaf: {
    backgroundColor: rabbehniTokens.color.mint,
    borderBottomLeftRadius: 9,
    borderTopRightRadius: 9,
    height: 17,
    position: "absolute",
    width: 9,
  },
  markLeafOne: {
    left: 3,
    top: 8,
    transform: [{ rotate: "-24deg" }],
  },
  markLeafTwo: {
    left: 11,
    top: 2,
    transform: [{ rotate: "8deg" }],
  },
  markLeafThree: {
    backgroundColor: rabbehniTokens.color.aqua,
    left: 18,
    top: 9,
    transform: [{ rotate: "35deg" }],
  },
  button: {
    alignItems: "center",
    backgroundColor: rabbehniTokens.color.mint,
    borderRadius: rabbehniTokens.radius.pill,
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  buttonSecondary: {
    backgroundColor: "rgba(255,255,255,.08)",
    borderColor: "rgba(255,255,255,.16)",
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#062019",
    fontSize: 16,
    fontWeight: "800",
  },
  buttonSecondaryText: {
    color: "#ecf8f4",
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: "rgba(241,250,247,.78)",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "rgba(4,17,20,.45)",
    borderColor: "rgba(255,255,255,.14)",
    borderRadius: 18,
    borderWidth: 1,
    color: "#f3fbf8",
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
  },
});
