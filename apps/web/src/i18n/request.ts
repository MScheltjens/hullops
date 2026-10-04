import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/dal";
import { type AppLocale, localeFromAcceptLanguage } from "./locales";

/**
 * Decides the language for each request (picked up automatically by the
 * next-intl plugin in next.config.ts).
 *
 * The language isn't part of the URL: this is a tool behind a login, and each
 * user has a language setting (User.locale in the API). Before login, the
 * browser's preferred language is used.
 */
export default getRequestConfig(async () => {
  const user = await getCurrentUser();
  const locale: AppLocale = user
    ? (user.locale.toLowerCase() as AppLocale)
    : localeFromAcceptLanguage((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Shipyard times are local German times. A fixed time zone also makes
    // the server and the browser format dates identically.
    timeZone: "Europe/Berlin",
  };
});
