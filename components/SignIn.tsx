import { FontAwesome } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const PRIMARY_BLUE = "#2CB9FF";
const LIGHT_GRAY = "#F2F4F7";
const TEXT_MUTED = "#6B7280";

const SignIn = () => {
  const [email, setEmail] = useState("");

  const handleContinue = () => {
    // TODO: replace with real auth flow
    alert(`Email: ${email}`);
  };

  const handleGoogle = () => {
    alert("Connexion avec Google");
  };

  const handleApple = () => {
    alert("Connexion avec Apple");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safeArea}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require("../assets/images/pickeat-logo-blue.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Créez un compte</Text>
          <Text style={styles.subtitle}>
            Entrez votre email pour vous connecter
          </Text>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="email@domain.com"
              placeholderTextColor={TEXT_MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continuer</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogle}
            activeOpacity={0.85}
          >
            <FontAwesome name="google" size={18} color="#4285F4" />
            <Text style={styles.socialText}>Continuer avec Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton]}
            onPress={handleApple}
            activeOpacity={0.85}
          >
            <FontAwesome name="apple" size={20} color="#000" />
            <Text style={styles.socialText}>Continuer avec Apple</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            En cliquant continuer, vous adhérez à nos{" "}
            <Text style={styles.linkText}>Termes de Service</Text> et à notre{" "}
            <Text style={styles.linkText}>Politique de confidentialité</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
    marginTop: 8,
    marginBottom: 24,
    textAlign: "center",
  },
  inputWrapper: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: LIGHT_GRAY,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  input: {
    height: 48,
    fontSize: 16,
    color: "#111827",
  },
  primaryButton: {
    width: "100%",
    height: 54,
    borderRadius: 12,
    backgroundColor: PRIMARY_BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  divider: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    marginHorizontal: 12,
    color: TEXT_MUTED,
    fontSize: 14,
  },
  socialButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  appleButton: {
    backgroundColor: "#F7F7F7",
  },
  socialText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  disclaimer: {
    marginTop: 16,
    color: TEXT_MUTED,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  linkText: {
    color: PRIMARY_BLUE,
    fontWeight: "600",
  },
});

export default SignIn;
