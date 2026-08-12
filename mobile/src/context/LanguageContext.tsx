import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { vi, Translations } from "../i18n/vi";
import { en } from "../i18n/en";
import { storage } from "../utils/storage";

export type Language = "vi" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: (path: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translationsMap: Record<Language, Translations> = {
  vi,
  en,
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("vi");

  useEffect(() => {
    const loadLanguage = async () => {
      const savedLang = await storage.getLanguage();
      if (savedLang === "vi" || savedLang === "en") {
        setLanguageState(savedLang);
      } else {
        setLanguageState("vi");
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await storage.setLanguage(lang);
  };

  const toggleLanguage = async () => {
    const newLang: Language = language === "vi" ? "en" : "vi";
    await setLanguage(newLang);
  };

  const t = (path: string, fallback?: string): string => {
    const keys = path.split(".");
    let current: any = translationsMap[language];

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        // `en` is statically typed from Vietnamese keys. Never fall back to
        // Vietnamese here, or a missing English key would create mixed UI.
        return fallback || path;
      }
    }

    if (typeof current === "string") {
      return current;
    }

    return fallback || path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
