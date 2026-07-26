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
import { Mail, Lock, User as UserIcon, Phone, UserPlus, ArrowLeft } from "lucide-react-native";
import { useRegister } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { InlineBanner } from "../../components/ui/InlineBanner";
import { COLORS } from "../../utils/constants";

interface RegisterValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

function validateRegister(values: RegisterValues) {
  const errs: Partial<Record<keyof RegisterValues, string>> = {};
  if (!values.fullName || values.fullName.trim().length < 2) {
    errs.fullName = "Please enter your full name.";
  }
  if (!values.email || !values.email.includes("@")) {
    errs.email = "Please enter a valid email address.";
  }
  if (!values.password || values.password.length < 6) {
    errs.password = "Password must be at least 6 characters.";
  }
  if (values.confirmPassword !== values.password) {
    errs.confirmPassword = "Passwords do not match.";
  }
  return errs;
}

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const registerMutation = useRegister();

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const { values, errors, setField, validate } = useFormValidation<RegisterValues>(
    {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
    validateRegister
  );

  const handleRegister = async () => {
    setSubmitError(null);
    if (!validate()) return;
    try {
      const parts = values.fullName.trim().split(" ").filter(Boolean);
      const firstName = parts[0] || values.fullName.trim();
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;

      await registerMutation.mutateAsync({
        fullName: values.fullName.trim(),
        firstName,
        lastName,
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconBox}>
            <UserPlus size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join EcoAlert to protect your environment and report municipal hazards.
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <InlineBanner message={submitError} type="error" />

          <Input
            label="Full Name"
            placeholder="Nguyen Van A"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            value={values.fullName}
            onChangeText={(v: string) => setField("fullName", v)}
            error={errors.fullName}
            leftIcon={<UserIcon size={20} color={COLORS.textMuted} />}
          />

          <Input
            ref={emailRef}
            label="Email Address"
            placeholder="citizen@ecoalert.org"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            value={values.email}
            onChangeText={(v: string) => setField("email", v)}
            error={errors.email}
            leftIcon={<Mail size={20} color={COLORS.textMuted} />}
          />

          <Input
            ref={phoneRef}
            label="Phone Number (Optional)"
            placeholder="0912345678"
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={values.phone}
            onChangeText={(v: string) => setField("phone", v)}
            error={errors.phone}
            leftIcon={<Phone size={20} color={COLORS.textMuted} />}
          />

          <Input
            ref={passwordRef}
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            value={values.password}
            onChangeText={(v: string) => setField("password", v)}
            error={errors.password}
            leftIcon={<Lock size={20} color={COLORS.textMuted} />}
          />

          <Input
            ref={confirmPasswordRef}
            label="Confirm Password"
            placeholder="••••••••"
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            value={values.confirmPassword}
            onChangeText={(v: string) => setField("confirmPassword", v)}
            error={errors.confirmPassword}
            leftIcon={<Lock size={20} color={COLORS.textMuted} />}
          />

          <Button
            title="Register Account"
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
    paddingTop: 48,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: { alignItems: "center", marginBottom: 24 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text, marginBottom: 6 },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  card: { padding: 20, borderRadius: 24 },
  registerBtn: { marginTop: 12 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  loginLink: { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
});
