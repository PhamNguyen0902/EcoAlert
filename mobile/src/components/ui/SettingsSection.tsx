import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Sun, Moon, Laptop, Globe, Palette } from "lucide-react-native";
import { useTheme, ThemeMode } from "../../context/ThemeContext";
import { useLanguage, Language } from "../../context/LanguageContext";
import { GlassCard } from "./GlassCard";

export const SettingsSection: React.FC = () => {
  const { themeMode, setThemeMode, colors } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const themeOptions: { mode: ThemeMode; labelKey: string; icon: any }[] = [
    { mode: "light", labelKey: "profile.themeLight", icon: Sun },
    { mode: "dark", labelKey: "profile.themeDark", icon: Moon },
    { mode: "system", labelKey: "profile.themeSystem", icon: Laptop },
  ];

  const languageOptions: { lang: Language; labelKey: string; flag: string }[] = [
    { lang: "vi", labelKey: "profile.langVi", flag: "🇻🇳" },
    { lang: "en", labelKey: "profile.langEn", flag: "🇺🇸" },
  ];

  return (
    <GlassCard style={styles.card}>
      <View style={styles.sectionHeader}>
        <Palette size={18} color={colors.primary} style={styles.headerIcon} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t("profile.settingsHeader", "App Settings")}
        </Text>
      </View>

      {/* Theme Selection */}
      <View style={styles.settingGroup}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t("profile.appearance", "Appearance")}
        </Text>
        <View style={[styles.optionsRow, { backgroundColor: colors.isDark ? "#0F172A" : "#F1F5F9" }]}>
          {themeOptions.map(({ mode, labelKey, icon: IconComponent }) => {
            const active = themeMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => setThemeMode(mode)}
                style={[
                  styles.optionTab,
                  active && {
                    backgroundColor: colors.surface,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  },
                ]}
                activeOpacity={0.7}
              >
                <IconComponent
                  size={16}
                  color={active ? colors.primary : colors.textMuted}
                  style={styles.tabIcon}
                />
                <Text
                  style={[
                    styles.optionText,
                    { color: active ? colors.primary : colors.textMuted },
                    active && styles.activeText,
                  ]}
                >
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Language Selection */}
      <View style={[styles.settingGroup, { marginTop: 16 }]}>
        <View style={styles.labelRow}>
          <Globe size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t("profile.language", "Language")}
          </Text>
        </View>
        <View style={[styles.optionsRow, { backgroundColor: colors.isDark ? "#0F172A" : "#F1F5F9" }]}>
          {languageOptions.map(({ lang, labelKey, flag }) => {
            const active = language === lang;
            return (
              <TouchableOpacity
                key={lang}
                onPress={() => setLanguage(lang)}
                style={[
                  styles.optionTab,
                  active && {
                    backgroundColor: colors.surface,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={styles.flagText}>{flag}</Text>
                <Text
                  style={[
                    styles.optionText,
                    { color: active ? colors.primary : colors.textMuted },
                    active && styles.activeText,
                  ]}
                >
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 20,
    padding: 16,
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  headerIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  settingGroup: {
    width: "100%",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  optionsRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
  },
  optionTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabIcon: {
    marginRight: 6,
  },
  flagText: {
    fontSize: 14,
    marginRight: 6,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  activeText: {
    fontWeight: "700",
  },
});
