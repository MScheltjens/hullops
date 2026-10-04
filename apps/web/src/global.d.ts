import type messages from "../messages/en.json";
import type { AppLocale } from "./i18n/locales";

// Makes next-intl type-check translation keys: t("orders.titel") is a
// compile error instead of a raw key on screen.
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}
