"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localeFromAcceptLanguage } from "@/i18n/locales";
import { demoCredentials, isDemoMode } from "@/lib/demo-login";
import { ApiError, graphqlRequest } from "@/lib/server/api";
import { saveSession } from "@/lib/server/session";

export interface LoginState {
  error?: "invalid" | "unavailable";
  /** Echoed back so the email field keeps its value after an error. */
  email?: string;
}

const LOGIN = `
  mutation ($input: LoginInput!) {
    login(input: $input) { accessToken expiresAt }
  }`;

const SET_LOCALE = `
  mutation ($locale: Locale!) {
    setMyLocale(locale: $locale) { locale }
  }`;

/**
 * Logs in and saves the session. Returns what went wrong, or nothing when it
 * worked. With a `locale`, also saves that as the user's language.
 */
async function signIn(
  email: string,
  password: string,
  locale?: "EN" | "DE",
): Promise<LoginState["error"]> {
  try {
    const { login } = await graphqlRequest<{
      login: { accessToken: string; expiresAt: string };
    }>(LOGIN, { input: { email, password } });
    if (locale) {
      await graphqlRequest(SET_LOCALE, { locale }, login.accessToken);
    }
    await saveSession(login.accessToken, new Date(login.expiresAt));
  } catch (error) {
    // Wrong credentials (or an empty or malformed email, which the API
    // rejects as BAD_REQUEST) get the same message, like the API itself.
    if (
      error instanceof ApiError &&
      ["UNAUTHENTICATED", "BAD_REQUEST"].includes(error.code)
    ) {
      return "invalid";
    }
    // The API is down or answered something unexpected.
    console.error("Login failed", error);
    return "unavailable";
  }
}

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const error = await signIn(email, password);
  if (error) return { error, email };

  // Outside signIn's try: redirect() works by throwing, which its catch would
  // otherwise swallow.
  // The home page sends each role to its own start page.
  redirect("/");
}

/**
 * One-tap login as a seeded demo user. Server Actions can be called directly,
 * so this checks demo mode itself instead of relying on the buttons being
 * hidden.
 *
 * Most demo users have German set, so the visitor's browser language is saved
 * on the user: someone reading English shouldn't land in a German app.
 */
export async function demoLogin(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const credentials = isDemoMode(process.env.DEMO_MODE)
    ? demoCredentials(String(formData.get("role") ?? ""))
    : undefined;
  if (!credentials) return { error: "invalid" };

  const language = localeFromAcceptLanguage(
    (await headers()).get("accept-language"),
  );
  const error = await signIn(
    credentials.email,
    credentials.password,
    language === "de" ? "DE" : "EN",
  );
  if (error) return { error };

  redirect("/");
}
