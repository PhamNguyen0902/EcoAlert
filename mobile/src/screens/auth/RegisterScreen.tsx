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
import { Mail, Lock, User as UserIcon, Phone, UserPlus, ArrowLeft, Sun, Moon, Globe, Eye, EyeOff } from "lucide-react-native";
import { useRegister } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { InlineBanner } from "../../components/ui/InlineBanner";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

interface RegisterValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const registerMutation = useRegister();
  const { colors, isDark, setThemeMode } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateRegister = (values: RegisterValues) => {
    const errs: Partial<Record<keyof RegisterValues, string>> = {};
    if (!values.fullName || values.fullName.trim().length < 2) {
      errs.fullName = t("auth.nameError", "Please enter your full name.");
    }
    if (!values.email || !values.email.includes("@")) {
      errs.email = t("auth.emailError", "Please enter a valid email address.");
    }
    if (!values.password || values.password.length < 6) {
      errs.password = t("auth.passwordError", "Password must be at least 6 characters.");
    }
    if (values.confirmPassword !== values.password) {
      errs.confirmPassword = t("auth.confirmPasswordError", "Passwords do not match.");
    }
    return errs;
  };

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
      const msg = err.response?.data?.message || err.message || "Đăng ký thất bại. Vui lòng thử lại.";
      setSubmitError(msg);
    }
  };

  const toggleTheme = () => {
    setThemeMode(isDark ? "light" : "dark");
  };

  const toggleLanguage = () => {
    setLanguage(language === "vi" ? "en" : "vi");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.topRightBtns}>
            <TouchableOpacity
              onPress={toggleLanguage}
              style={[styles.topBarBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Globe size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.topBarText, { color: colors.text }]}>
                {language === "vi" ? "VN 🇻🇳" : "EN 🇺🇸"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.topBarBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              {isDark ? (
                <Sun size={16} color="#F59E0B" />
              ) : (
                <Moon size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.header}>
          <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
            <UserPlus size={40} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("auth.createAccount", "Create Account")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("auth.registerSubtitle", "Join EcoAlert to contribute to protecting your surrounding environment.")}
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <InlineBanner message={submitError} type="error" />

          <Input
            label={t("auth.fullNameLabel", "Full Name")}
            placeholder={t("auth.fullNamePlaceholder", "Nguyen Van A")}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            value={values.fullName}
            onChangeText={(v: string) => setField("fullName", v)}
            error={errors.fullName}
            leftIcon={<UserIcon size={20} color={colors.textMuted} />}
          />

          <Input
            ref={emailRef}
            label={t("auth.emailLabel", "Email Address")}
            placeholder={t("auth.emailPlaceholder", "citizen@ecoalert.org")}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            value={values.email}
            onChangeText={(v: string) => setField("email", v)}
            error={errors.email}
            leftIcon={<Mail size={20} color={colors.textMuted} />}
          />

          <Input
            ref={phoneRef}
            label={t("modals.phoneNumber", "Phone Number")}
            placeholder="0912345678"
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={values.phone}
            onChangeText={(v: string) => setField("phone", v)}
            error={errors.phone}
            leftIcon={<Phone size={20} color={colors.textMuted} />}
          />

          <Input
            ref={passwordRef}
            label={t("auth.passwordLabel", "Password")}
            placeholder={t("auth.passwordPlaceholder", "••••••••")}
            secureTextEntry={!showPassword}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            value={values.password}
            onChangeText={(v: string) => setField("password", v)}
            error={errors.password}
            leftIcon={<Lock size={20} color={colors.textMuted} />}
            rightIcon={
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            }
          />

          <Input
            ref={confirmPasswordRef}
            label={t("auth.confirmPasswordLabel", "Confirm Password")}
            placeholder={t("auth.confirmPasswordPlaceholder", "••••••••")}
            secureTextEntry={!showConfirmPassword}
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            value={values.confirmPassword}
            onChangeText={(v: string) => setField("confirmPassword", v)}
            error={errors.confirmPassword}
            leftIcon={<Lock size={20} color={colors.textMuted} />}
            rightIcon={
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            }
          />

          <Button
            title={t("auth.signUpBtn", "Sign Up Now")}
            onPress={handleRegister}
            loading={registerMutation.isPending}
            disabled={registerMutation.isPending}
            style={styles.registerBtn}
          />
        </GlassCard>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            {t("auth.alreadyHaveAccount", "Already have an account?")}{" "}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")} accessibilityRole="button">
            <Text style={[styles.loginLink, { color: colors.primary }]}>
              {t("auth.signInLink", "Sign In")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  topNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  topRightBtns: {
    flexDirection: "row",
    gap: 8,
  },
  topBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  topBarText: {
    fontSize: 13,
    fontWeight: "700",
  },
  header: { alignItems: "center", marginBottom: 24 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  card: { padding: 20, borderRadius: 24 },
  registerBtn: { marginTop: 12 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: "700" },
});
