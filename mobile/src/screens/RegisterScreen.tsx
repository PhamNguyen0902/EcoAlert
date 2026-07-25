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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mail, Lock, User as UserIcon, Phone, ShieldCheck } from "lucide-react-native";
import { useRegister } from "../hooks/useAuth";
import { useFormValidation } from "../hooks/useFormValidation";
import { GlassCard } from "../components/ui/GlassCard";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { InlineBanner } from "../components/ui/InlineBanner";
import { COLORS } from "../utils/constants";

interface RegisterValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

function validateRegister(values: RegisterValues) {
  const errs: Partial<Record<keyof RegisterValues, string>> = {};
  if (!values.fullName.trim() || values.fullName.trim().length < 2) {
    errs.fullName = "Please enter your full name.";
  }
  if (!values.email || !values.email.includes("@")) {
    errs.email = "Please enter a valid email address.";
  }
  if (!values.password || values.password.length < 6) {
    errs.password = "Password must be at least 6 characters.";
  }
  return errs;
}

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const registerMutation = useRegister();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const { values, errors, setField, validate } = useFormValidation<RegisterValues>(
    { fullName: "", email: "", phone: "", password: "" },
    validateRegister
  );

  const handleRegister = async () => {
    setSubmitError(null);
    if (!validate()) return;
    try {
      await registerMutation.mutateAsync({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        password: values.password,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Registration failed. Please try again.";
      setSubmitError(msg);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <ShieldCheck size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Join EcoAlert</Text>
          <Text style={styles.subtitle}>
            Empowering citizens to protect our environment. Register to submit verified incident alerts.
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <InlineBanner message={submitError} type="error" />

          <Input
            label="Full Name"
            placeholder="Jane Doe"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            value={values.fullName}
            onChangeText={(v) => setField("fullName", v)}
            error={errors.fullName}
            leftIcon={<UserIcon size={20} color={COLORS.textMuted} />}
          />

          <Input
            ref={emailRef}
            label="Email Address"
            placeholder="jane@ecoalert.org"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            value={values.email}
            onChangeText={(v) => setField("email", v)}
            error={errors.email}
            leftIcon={<Mail size={20} color={COLORS.textMuted} />}
          />

          <Input
            ref={phoneRef}
            label="Phone Number (Optional)"
            placeholder="+1 234 567 8900"
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={values.phone}
            onChangeText={(v) => setField("phone", v)}
            leftIcon={<Phone size={20} color={COLORS.textMuted} />}
          />

          <Input
            ref={passwordRef}
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password-new"
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            value={values.password}
            onChangeText={(v) => setField("password", v)}
            error={errors.password}
            leftIcon={<Lock size={20} color={COLORS.textMuted} />}
            hint={!errors.password && values.password.length > 0 ? "Minimum 6 characters" : undefined}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={registerMutation.isPending}
            disabled={registerMutation.isPending}
            style={styles.registerBtn}
          />
        </GlassCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")} accessibilityRole="button">
            <Text style={styles.loginLink}>Sign In</Text>
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
  header: { alignItems: "center", marginBottom: 24 },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text, marginBottom: 6 },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  card: { padding: 24, borderRadius: 24 },
  registerBtn: { marginTop: 12 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  loginLink: { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
});