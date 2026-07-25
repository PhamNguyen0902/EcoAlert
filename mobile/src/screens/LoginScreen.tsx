import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Mail, Lock, ShieldAlert, ArrowRight } from "lucide-react-native";
import { useLogin } from "../hooks/useAuth";
import { useFormValidation } from "../hooks/useFormValidation";
import { GlassCard } from "../components/ui/GlassCard";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { InlineBanner } from "../components/ui/InlineBanner";
import { COLORS } from "../utils/constants";

interface LoginValues {
  email: string;
  password: string;
}

function validateLogin(values: LoginValues) {
  const errs: Partial<Record<keyof LoginValues, string>> = {};
  if (!values.email || !values.email.includes("@")) {
    errs.email = "Please enter a valid email address.";
  }
  if (!values.password || values.password.length < 6) {
    errs.password = "Password must be at least 6 characters.";
  }
  return errs;
}

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const loginMutation = useLogin();
  const passwordRef = useRef<TextInput>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { values, errors, setField, validate } = useFormValidation<LoginValues>(
    { email: "", password: "" },
    validateLogin
  );

  const handleLogin = async () => {
    setSubmitError(null);
    if (!validate()) return;
    try {
      await loginMutation.mutateAsync({ email: values.email.trim(), password: values.password });
      // Navigation is handled by the auth listener / root router.
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Login failed. Please check your credentials.";
      setSubmitError(msg);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <ShieldAlert size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Log in to EcoAlert to report and monitor environmental incidents in your area.
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <InlineBanner message={submitError} type="error" />

          <Input
            label="Email Address"
            placeholder="citizen@ecoalert.org"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={values.email}
            onChangeText={(v) => setField("email", v)}
            error={errors.email}
            leftIcon={<Mail size={20} color={COLORS.textMuted} />}
          />

          <Input
            ref={passwordRef}
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            value={values.password}
            onChangeText={(v) => setField("password", v)}
            error={errors.password}
            leftIcon={<Lock size={20} color={COLORS.textMuted} />}
          />

          <TouchableOpacity
            style={styles.forgotPass}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loginMutation.isPending}
            disabled={loginMutation.isPending}
            style={styles.loginBtn}
            icon={<ArrowRight size={18} color="#FFF" style={{ marginRight: 6 }} />}
          />
        </GlassCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")} accessibilityRole="button">
            <Text style={styles.registerLink}>Sign Up Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    paddingBottom: 40,
  },
  header: { alignItems: "center", marginBottom: 32 },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.text, marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  card: { padding: 24, borderRadius: 24 },
  forgotPass: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
  loginBtn: { marginTop: 8 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  registerLink: { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
});