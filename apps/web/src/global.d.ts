import type messages from "../messages/en.json";
import type { AppLocale } from "./i18n/locales";

// Makes next-intl type-check translation keys. A key that doesn't exist,
// e.g. a misspelled "orders.titel" instead of "orders.title", is then a
// compile error instead of a raw key on screen.
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}
