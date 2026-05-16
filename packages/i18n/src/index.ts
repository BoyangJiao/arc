import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

export { en } from "./locales/en";
export { zh } from "./locales/zh";

export const resources = {
  en: { translation: en },
  zh: { translation: zh },
} as const;

export type TranslationKeys = typeof en;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: "zh",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export { useTranslation } from "react-i18next";

export default i18n;
