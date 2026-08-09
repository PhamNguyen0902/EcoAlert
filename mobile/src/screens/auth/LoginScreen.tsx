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
import { Mail, Lock, ShieldAlert, Sun, Moon, Globe, Eye, EyeOff } from "lucide-react-native";
import { useLogin } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { InlineBanner } from "../../components/ui/InlineBanner";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

interface LoginValues {
  email: string;
  password: string;
}

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const loginMutation = useLogin();
  const passwordRef = useRef<TextInput>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { colors, isDark, setThemeMode, themeMode } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const validateLogin = (values: LoginValues) => {
    const errs: Partial<Record<keyof LoginValues, string>> = {};
    if (!values.email || !values.email.includes("@")) {
      errs.email = t("auth.emailError", "Please enter a valid email address.");
    }
    if (!values.password || values.password.length < 6) {
      errs.password = t("auth.passwordError", "Password must be at least 6 characters.");
    }
    return errs;
  };

  const { values, errors, setField, validate } = useFormValidation<LoginValues>(
    { email: "", password: "" },
    validateLogin,
  );

  const handleLogin = async () => {
    setSubmitError(null);
    if (!validate()) return;
    try {
      await loginMutation.mutateAsync({
        email: values.email.trim(),
        password: values.password,
      });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Login failed. Please check your credentials.";
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
        {/* Quick Language & Theme Bar */}
        <View style={styles.topBar}>
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

        <View style={styles.header}>
          <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
            <ShieldAlert size={40} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("auth.welcomeBack", "Welcome Back")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t(
              "auth.loginSubtitle",
              "Log in to EcoAlert to report and monitor environmental incidents in your area."
            )}
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <InlineBanner message={submitError} type="error" />

          <Input
            label={t("auth.emailLabel", "Email Address")}
            placeholder={t("auth.emailPlaceholder", "example@gmail.com")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={values.email}
            onChangeText={(v: string) => setField("email", v)}
            error={errors.email}
            leftIcon={<Mail size={20} color={colors.textMuted} />}
          />

          <Input
            ref={passwordRef}
            label={t("auth.passwordLabel", "Password")}
            placeholder={t("auth.passwordPlaceholder", "••••••••")}
            secureTextEntry={!showPassword}
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
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

          <TouchableOpacity
            style={styles.forgotPass}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
          >
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              {t("auth.forgotPassword", "Forgot Password?")}
            </Text>
          </TouchableOpacity>

          <Button
            title={t("auth.signInBtn", "Sign In")}
            onPress={handleLogin}
            loading={loginMutation.isPending}
            disabled={loginMutation.isPending}
            style={styles.loginBtn}
          />
        </GlassCard>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            {t("auth.dontHaveAccount", "Don't have an account?")}{" "}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Register")}
            accessibilityRole="button"
          >
            <Text style={[styles.registerLink, { color: colors.primary }]}>
              {t("auth.signUpLink", "Sign Up Now")}
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
    justifyContent: "center",
    paddingTop: 50,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 20,
  },
  topBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  topBarText: {
    fontSize: 13,
    fontWeight: "700",
  },
  header: { alignItems: "center", marginBottom: 28 },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  card: { padding: 24, borderRadius: 24 },
  forgotPass: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, fontWeight: "600" },
  loginBtn: { marginTop: 8 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  footerText: { fontSize: 14 },
  registerLink: { fontSize: 14, fontWeight: "700" },
});
