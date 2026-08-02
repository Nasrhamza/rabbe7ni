import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NativeMark } from "@rabbehni/design-system/native";

export interface CustomerRegistrationInput {
  readonly displayName: string;
  readonly email: string;
  readonly phone: string;
  readonly password: string;
  readonly locale: "fr-TN";
  readonly referralCode?: string;
}

export interface CustomerLoginInput {
  readonly email: string;
  readonly password: string;
}

interface CustomerAuthScreenProps {
  readonly authError: boolean;
  readonly loginLoading: boolean;
  readonly onLogin: (input: CustomerLoginInput) => Promise<void>;
  readonly onRegister: (input: CustomerRegistrationInput) => Promise<void>;
}

function AuthField({
  autoCapitalize = "none",
  keyboardType = "default",
  onChangeText,
  placeholder,
  secureTextEntry = false,
  value,
}: Readonly<{
  autoCapitalize?: "none" | "words";
  keyboardType?: "default" | "email-address" | "phone-pad";
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
}>) {
  return (
    <TextInput
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#728198"
      secureTextEntry={secureTextEntry}
      style={styles.input}
      value={value}
    />
  );
}

export function CustomerAuthScreen({
  authError,
  loginLoading,
  onLogin,
  onRegister,
}: CustomerAuthScreenProps) {
  const { height } = useWindowDimensions();
  const cardHeight = Math.min(Math.max(height - 92, 570), 710);
  const loginProgress = useRef(new Animated.Value(1)).current;
  const [loginOpen, setLoginOpen] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string>();
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string>();

  function switchMode(nextLoginOpen: boolean) {
    setLoginOpen(nextLoginOpen);
    Animated.spring(loginProgress, {
      damping: 18,
      mass: 0.8,
      stiffness: 125,
      toValue: nextLoginOpen ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }

  async function submitRegistration() {
    setRegistrationError(undefined);
    if (!displayName.trim() || !email.trim() || !phone.trim() || !password) {
      setRegistrationError("Remplissez tous les champs pour créer votre compte.");
      return;
    }
    if (password.length < 10) {
      setRegistrationError("Le mot de passe doit contenir au moins 10 caractères.");
      return;
    }
    setRegistering(true);
    try {
      await onRegister({
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        locale: "fr-TN",
        ...(referralCode.trim() ? { referralCode: referralCode.trim().toUpperCase() } : {}),
      });
      setRegistrationSuccess(true);
      setPassword("");
      switchMode(true);
    } catch (error) {
      setRegistrationError(
        error instanceof Error ? error.message : "La création du compte a échoué.",
      );
    } finally {
      setRegistering(false);
    }
  }

  async function submitLogin() {
    setLoginError(undefined);
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Saisissez votre email et votre mot de passe.");
      return;
    }
    try {
      await onLogin({ email: loginEmail.trim().toLowerCase(), password: loginPassword });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "La connexion a échoué.");
    }
  }

  const loginTranslateY = loginProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [cardHeight - 112, 0],
  });
  const signupScale = loginProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.68],
  });

  return (
    <LinearGradient colors={["#0f0c29", "#302b63", "#24243e"]} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboard}
        >
          <View style={[styles.card, { height: cardHeight }]}>
            <View style={styles.signupPanel}>
              <Animated.View style={{ transform: [{ scale: signupScale }] }}>
                <Pressable onPress={() => switchMode(false)}>
                  <Text style={styles.signupTitle}>Créer un compte</Text>
                </Pressable>
              </Animated.View>
              <Text style={styles.signupSubtitle}>
                Rejoignez Rabbehni et profitez de vos avantages.
              </Text>
              <View style={styles.formStack}>
                <AuthField
                  autoCapitalize="words"
                  onChangeText={setDisplayName}
                  placeholder="Nom et prénom"
                  value={displayName}
                />
                <AuthField
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="Adresse email"
                  value={email}
                />
                <AuthField
                  keyboardType="phone-pad"
                  onChangeText={setPhone}
                  placeholder="Numéro de téléphone"
                  value={phone}
                />
                <AuthField
                  onChangeText={setPassword}
                  placeholder="Mot de passe sécurisé"
                  secureTextEntry
                  value={password}
                />
                <AuthField
                  onChangeText={setReferralCode}
                  placeholder="Code de parrainage (facultatif)"
                  value={referralCode}
                />
              </View>
              {registrationError ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {registrationError}
                </Text>
              ) : (
                <Text style={styles.passwordHint}>
                  10 caractères, majuscule, chiffre et symbole.
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={registering}
                onPress={() => void submitRegistration()}
                style={({ pressed }) => [
                  styles.signupButton,
                  pressed && styles.buttonPressed,
                  registering && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.signupButtonText}>
                  {registering ? "Création…" : "S’inscrire"}
                </Text>
              </Pressable>
            </View>

            <Animated.View
              pointerEvents={loginOpen ? "auto" : "box-none"}
              style={[
                styles.loginPanel,
                { height: cardHeight, transform: [{ translateY: loginTranslateY }] },
              ]}
            >
              <Pressable onPress={() => switchMode(true)} style={styles.loginHandle}>
                <View style={styles.handleBar} />
                <Text style={styles.loginTitle}>Connexion</Text>
              </Pressable>
              <View style={styles.loginContent}>
                <NativeMark />
                <Text style={styles.loginHero}>Heureux de vous revoir.</Text>
                <Text style={styles.loginDescription}>
                  Connectez-vous pour retrouver vos points, votre QR et vos récompenses.
                </Text>
                <View style={styles.loginFields}>
                  <AuthField
                    keyboardType="email-address"
                    onChangeText={setLoginEmail}
                    placeholder="Adresse email"
                    value={loginEmail}
                  />
                  <AuthField
                    onChangeText={setLoginPassword}
                    placeholder="Mot de passe"
                    secureTextEntry
                    value={loginPassword}
                  />
                </View>
                {registrationSuccess && (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>
                      Compte créé. Vérifiez votre email puis connectez-vous.
                    </Text>
                  </View>
                )}
                {(loginError || authError) && (
                  <Text accessibilityRole="alert" style={styles.loginError}>
                    {loginError ?? "La connexion sécurisée n’a pas abouti. Réessayez."}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={loginLoading}
                  onPress={() => void submitLogin()}
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.buttonPressed,
                    loginLoading && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.loginButtonText}>
                    {loginLoading ? "Connexion…" : "Se connecter"}
                  </Text>
                </Pressable>
                <Text style={styles.secureLabel}>Connexion sécurisée par Keycloak</Text>
                <Pressable onPress={() => switchMode(false)}>
                  <Text style={styles.switchText}>Pas encore de compte ? S’inscrire</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 18, paddingVertical: 12 },
  keyboard: { alignItems: "center", flex: 1, justifyContent: "center" },
  card: {
    backgroundColor: "#17133d",
    borderColor: "rgba(255,255,255,.16)",
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 430,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.42,
    shadowRadius: 28,
    width: "100%",
  },
  signupPanel: { alignItems: "stretch", paddingHorizontal: 34, paddingTop: 28 },
  signupTitle: {
    color: "#fff",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1.1,
    textAlign: "center",
  },
  signupSubtitle: {
    color: "rgba(255,255,255,.68)",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
    marginTop: 5,
    textAlign: "center",
  },
  formStack: { gap: 10 },
  input: {
    backgroundColor: "#f0f2f5",
    borderColor: "transparent",
    borderRadius: 9,
    borderWidth: 1,
    color: "#172b4d",
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 15,
  },
  passwordHint: { color: "rgba(255,255,255,.52)", fontSize: 10, marginTop: 8, textAlign: "center" },
  errorText: { color: "#ffb4a9", fontSize: 11, marginTop: 8, textAlign: "center" },
  signupButton: {
    alignItems: "center",
    backgroundColor: "#0d6efd",
    borderRadius: 9,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 48,
  },
  signupButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  loginPanel: {
    backgroundColor: "#f7f8fb",
    borderTopLeftRadius: 62,
    borderTopRightRadius: 62,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  loginHandle: { alignItems: "center", minHeight: 112, paddingTop: 14 },
  handleBar: { backgroundColor: "#c7ccd5", borderRadius: 9, height: 4, width: 44 },
  loginTitle: {
    color: "#573b8a",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 20,
  },
  loginContent: { alignItems: "stretch", paddingHorizontal: 38, paddingTop: 46 },
  loginHero: {
    color: "#172b4d",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.1,
    lineHeight: 34,
    marginTop: 34,
  },
  loginDescription: { color: "#65758b", fontSize: 14, lineHeight: 21, marginTop: 12 },
  loginFields: { gap: 10, marginTop: 20 },
  loginButton: {
    alignItems: "center",
    backgroundColor: "#573b8a",
    borderRadius: 9,
    justifyContent: "center",
    marginTop: 26,
    minHeight: 52,
  },
  loginButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  buttonPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.5 },
  secureLabel: { color: "#8490a3", fontSize: 10, marginTop: 12, textAlign: "center" },
  switchText: {
    color: "#573b8a",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 22,
    textAlign: "center",
  },
  successBox: {
    backgroundColor: "#d1e7dd",
    borderColor: "#a3cfbb",
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 18,
    padding: 11,
  },
  successText: { color: "#0f5132", fontSize: 11, fontWeight: "700", lineHeight: 16 },
  loginError: { color: "#b02a37", fontSize: 11, marginTop: 16 },
});
