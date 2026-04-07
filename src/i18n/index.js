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

const namespaces = [
  "common", "header", "sidebar", "hero", "taskbox",
  "bank-accounts", "bank-transactions", "rules", "reconciliation",
  "financial", "audit", "close", "team", "manual-je", "conv-je",
  "aminah", "notifications",
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
