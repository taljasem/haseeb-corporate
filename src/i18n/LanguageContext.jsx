import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import i18n from "./index";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(i18n.language || "en");

  const isRTL = language === "ar";

  const setLanguage = useCallback(async (lang) => {
    await i18n.changeLanguage(lang);
    setLanguageState(lang);
    try {
      localStorage.setItem("haseeb-language", lang);
    } catch (e) { /* ignore */ }
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "ar" : "en");
  }, [language, setLanguage]);

  useEffect(() => {
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", language);
  }, [language, isRTL]);

  const value = useMemo(
    () => ({ language, isRTL, setLanguage, toggleLanguage }),
    [language, isRTL, setLanguage, toggleLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
