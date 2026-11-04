"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { apiAsUser, type Locale } from "@/lib/server/dal";
import { clearSession } from "@/lib/server/session";

export async function logout() {
  await clearSession();
  redirect("/login");
}

/**
 * Saves the user's language in the API (User.locale) and re-renders the
 * page, which then picks up the new language (see src/i18n/request.ts).
 */
export async function setLocale(locale: Locale) {
  await apiAsUser(
    "mutation ($locale: Locale!) { setMyLocale(locale: $locale) { locale } }",
    { locale },
  );
  refresh();
}
