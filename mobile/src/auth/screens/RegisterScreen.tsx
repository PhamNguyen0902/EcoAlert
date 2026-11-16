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
  Alert,
  Linking,
  Modal,
} from "react-native";
import { Mail, Lock, User as UserIcon, Phone, UserPlus, ArrowLeft, Sun, Moon, Globe, Eye, EyeOff } from "lucide-react-native";
import { useRegister } from "../hooks/useAuth";
import { authService } from "../api/authService";
import { useFormValidation } from "../../shared/hooks/useFormValidation";
import { GlassCard } from "../../shared/components/ui/GlassCard";
import { Input } from "../../shared/components/ui/Input";
import { Button } from "../../shared/components/ui/Button";
import { InlineBanner } from "../../shared/components/ui/InlineBanner";
import { useTheme } from "../../shared/context/ThemeContext";
import { useLanguage } from "../../shared/context/LanguageContext";

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

  const emailRef = useRef<any>(null);
  const phoneRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmPasswordRef = useRef<any>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States quản lý Modal OTP 6 số của AWS Cognito
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

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

  // Hàm mở thẳng Google Gmail
  const openEmailApp = async () => {
    try {
      await Linking.openURL("googlegmail://");
    } catch (err) {
      try {
        if (Platform.OS === "android") {
          await Linking.openURL(
            "intent:#Intent;package=com.google.android.gm;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;end"
          );
        } else {
          await Linking.openURL("https://mail.google.com");
        }
      } catch {
        await Linking.openURL("https://mail.google.com");
      }
    }
  };

  // 1. Xử lý bấm Đăng ký -> Cognito gửi OTP và mở popup nhập mã
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

      // Mở modal nhập OTP 6 số
      setOtpCode("");
      setOtpError(null);
      setShowOtpModal(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Đăng ký thất bại. Vui lòng thử lại.";
      setSubmitError(msg);
    }
  };

  // 2. Xử lý xác thực OTP 6 số với AWS Cognito
  const handleConfirmOtp = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      setOtpError("Vui lòng nhập đủ 6 chữ số mã xác thực.");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      await authService.confirmOtp({
        email: values.email.trim(),
        code: otpCode.trim(),
      });
      setShowOtpModal(false);
      Alert.alert(
        "Kích hoạt thành công!",
        "Tài khoản của bạn đã được xác thực qua AWS Cognito thành công. Vui lòng đăng nhập.",
        [
          {
            text: "Đến trang Đăng nhập",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
    } catch (err: any) {
      setOtpError(
        err.response?.data?.message || err.message || "Xác thực mã OTP thất bại."
      );
    } finally {
      setOtpLoading(false);
    }
  };

  // 3. Xử lý gửi lại mã OTP 6 số
  const handleResendOtp = async () => {
    try {
      await authService.resendOtp(values.email.trim());
      Alert.alert(
        "Đã gửi lại mã",
        "Mã xác thực OTP mới đã được gửi tới: " + values.email.trim()
      );
    } catch (err: any) {
      Alert.alert(
        "Lỗi",
        err.response?.data?.message || err.message || "Không thể gửi lại mã OTP."
      );
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
            <UserPlus size={36} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("auth.createAccount", "Create Account")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t(
              "auth.registerSubtitle",
              "Join EcoAlert to contribute to protecting the environment around you."
            )}
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <InlineBanner message={submitError} type="error" />

          <Input
            label={t("auth.nameLabel", "Full Name")}
            placeholder={t("auth.namePlaceholder", "Nguyen Van A")}
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
            placeholder={t("auth.emailPlaceholder", "example@gmail.com")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            value={values.email}
            onChangeText={(v: string) => setField("email", v)}
            error={errors.email}
            leftIcon={<Mail size={20} color={colors.textMuted} />}
          />

          <Input
            ref={phoneRef}
            label={t("auth.phoneLabel", "Phone Number (Optional)")}
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
            autoComplete="new-password"
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
            autoComplete="new-password"
            returnKeyType="done"
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

      {/* MODAL NHẬP MÃ OTP 6 SỐ AWS COGNITO */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtpModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalIconBox, { backgroundColor: colors.primaryLight }]}>
              <Mail size={32} color={colors.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Xác thực mã OTP
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              AWS Cognito đã gửi mã xác thực 6 số đến email:{"\n"}
              <Text style={{ fontWeight: "bold", color: colors.primary }}>
                {values.email.trim()}
              </Text>
            </Text>

            {otpError && (
              <View style={styles.otpErrorBox}>
                <Text style={styles.otpErrorText}>{otpError}</Text>
              </View>
            )}

            <TextInput
              style={[
                styles.otpInput,
                {
                  color: colors.text,
                  borderColor: otpError ? colors.destructive : colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={(text) => {
                setOtpCode(text);
                if (otpError) setOtpError(null);
              }}
              autoFocus
            />

            <Button
              title="Xác nhận kích hoạt"
              onPress={handleConfirmOtp}
              loading={otpLoading}
              style={{ width: "100%", marginTop: 12 }}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity onPress={handleResendOtp} style={styles.modalLinkBtn}>
                <Text style={[styles.modalLinkText, { color: colors.primary }]}>
                  Gửi lại mã
                </Text>
              </TouchableOpacity>

              <Text style={{ color: colors.textMuted }}>•</Text>

              <TouchableOpacity onPress={openEmailApp} style={styles.modalLinkBtn}>
                <Text style={[styles.modalLinkText, { color: colors.primary }]}>
                  Mở Gmail
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowOtpModal(false)}
              style={{ marginTop: 16 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: "underline" }}>
                Đóng / Để sau
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Styles cho Modal OTP
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  otpInput: {
    width: "100%",
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 10,
    marginBottom: 8,
  },
  otpErrorBox: {
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    width: "100%",
  },
  otpErrorText: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 16,
  },
  modalLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalLinkText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
