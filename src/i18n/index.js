import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enHeader from "./locales/en/header.json";
import enSidebar from "./locales/en/sidebar.json";
import enHero from "./locales/en/hero.json";
import enTaskbox from "./locales/en/taskbox.json";
import enBankAccounts from "./locales/en/bank-accounts.json";
import enBankTransactions from "./locales/en/bank-transactions.json";
import enRules from "./locales/en/rules.json";
import enReconciliation from "./locales/en/reconciliation.json";
import enFinancial from "./locales/en/financial.json";
import enAudit from "./locales/en/audit.json";
import enClose from "./locales/en/close.json";
import enTeam from "./locales/en/team.json";
import enManualJe from "./locales/en/manual-je.json";
import enConvJe from "./locales/en/conv-je.json";
import enAminah from "./locales/en/aminah.json";
import enNotifications from "./locales/en/notifications.json";
import enCfoToday from "./locales/en/cfo-today.json";
import enBudget from "./locales/en/budget.json";
import enOwnerToday from "./locales/en/owner-today.json";
import enJuniorToday from "./locales/en/junior-today.json";
import enOwnerOverview from "./locales/en/owner-overview.json";
import enSettings from "./locales/en/settings.json";
import enProfile from "./locales/en/profile.json";
import enForecast from "./locales/en/forecast.json";
import enVariance from "./locales/en/variance.json";
import enAging from "./locales/en/aging.json";
import enSetup from "./locales/en/setup.json";
import enPettyCash from "./locales/en/petty-cash.json";
import enBulkReclass from "./locales/en/bulk-reclass.json";
import enOcr from "./locales/en/ocr.json";
import enInventoryCount from "./locales/en/inventory-count.json";
import enSpinoff from "./locales/en/spinoff.json";
import enIslamicFinance from "./locales/en/islamic-finance.json";

import arCommon from "./locales/ar/common.json";
import arHeader from "./locales/ar/header.json";
import arSidebar from "./locales/ar/sidebar.json";
import arHero from "./locales/ar/hero.json";
import arTaskbox from "./locales/ar/taskbox.json";
import arBankAccounts from "./locales/ar/bank-accounts.json";
import arBankTransactions from "./locales/ar/bank-transactions.json";
import arRules from "./locales/ar/rules.json";
import arReconciliation from "./locales/ar/reconciliation.json";
import arFinancial from "./locales/ar/financial.json";
import arAudit from "./locales/ar/audit.json";
import arClose from "./locales/ar/close.json";
import arTeam from "./locales/ar/team.json";
import arManualJe from "./locales/ar/manual-je.json";
import arConvJe from "./locales/ar/conv-je.json";
import arAminah from "./locales/ar/aminah.json";
import arNotifications from "./locales/ar/notifications.json";
import arCfoToday from "./locales/ar/cfo-today.json";
import arBudget from "./locales/ar/budget.json";
import arOwnerToday from "./locales/ar/owner-today.json";
import arJuniorToday from "./locales/ar/junior-today.json";
import arOwnerOverview from "./locales/ar/owner-overview.json";
import arSettings from "./locales/ar/settings.json";
import arProfile from "./locales/ar/profile.json";
import arForecast from "./locales/ar/forecast.json";
import arVariance from "./locales/ar/variance.json";
import arAging from "./locales/ar/aging.json";
import arSetup from "./locales/ar/setup.json";
import arPettyCash from "./locales/ar/petty-cash.json";
import arBulkReclass from "./locales/ar/bulk-reclass.json";
import arOcr from "./locales/ar/ocr.json";
import arInventoryCount from "./locales/ar/inventory-count.json";
import arSpinoff from "./locales/ar/spinoff.json";
import arIslamicFinance from "./locales/ar/islamic-finance.json";

const namespaces = [
  "common", "header", "sidebar", "hero", "taskbox",
  "bank-accounts", "bank-transactions", "rules", "reconciliation",
  "financial", "audit", "close", "team", "manual-je", "conv-je",
  "aminah", "notifications", "cfo-today",
  "budget", "owner-today", "junior-today", "owner-overview",
  "settings", "profile", "forecast", "variance", "aging", "setup",
  "petty-cash", "bulk-reclass", "ocr", "inventory-count",
  "spinoff", "islamic-finance",
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        header: enHeader,
        sidebar: enSidebar,
        hero: enHero,
        taskbox: enTaskbox,
        "bank-accounts": enBankAccounts,
        "bank-transactions": enBankTransactions,
        rules: enRules,
        reconciliation: enReconciliation,
        financial: enFinancial,
        audit: enAudit,
        close: enClose,
        team: enTeam,
        "manual-je": enManualJe,
        "conv-je": enConvJe,
        aminah: enAminah,
        notifications: enNotifications,
        "cfo-today": enCfoToday,
        budget: enBudget,
        "owner-today": enOwnerToday,
        "junior-today": enJuniorToday,
        "owner-overview": enOwnerOverview,
        settings: enSettings,
        profile: enProfile,
        forecast: enForecast,
        variance: enVariance,
        aging: enAging,
        setup: enSetup,
        "petty-cash": enPettyCash,
        "bulk-reclass": enBulkReclass,
        ocr: enOcr,
        "inventory-count": enInventoryCount,
        spinoff: enSpinoff,
        "islamic-finance": enIslamicFinance,
      },
      ar: {
        common: arCommon,
        header: arHeader,
        sidebar: arSidebar,
        hero: arHero,
        taskbox: arTaskbox,
        "bank-accounts": arBankAccounts,
        "bank-transactions": arBankTransactions,
        rules: arRules,
        reconciliation: arReconciliation,
        financial: arFinancial,
        audit: arAudit,
        close: arClose,
        team: arTeam,
        "manual-je": arManualJe,
        "conv-je": arConvJe,
        aminah: arAminah,
        notifications: arNotifications,
        "cfo-today": arCfoToday,
        budget: arBudget,
        "owner-today": arOwnerToday,
        "junior-today": arJuniorToday,
        "owner-overview": arOwnerOverview,
        settings: arSettings,
        profile: arProfile,
        forecast: arForecast,
        variance: arVariance,
        aging: arAging,
        setup: arSetup,
        "petty-cash": arPettyCash,
        "bulk-reclass": arBulkReclass,
        ocr: arOcr,
        "inventory-count": arInventoryCount,
        spinoff: arSpinoff,
        "islamic-finance": arIslamicFinance,
      },
    },
    fallbackLng: "en",
    defaultNS: "common",
    ns: namespaces,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "haseeb-language",
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
