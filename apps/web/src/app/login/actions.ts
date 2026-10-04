"use server";

import { redirect } from "next/navigation";
import { ApiError, graphqlRequest } from "@/lib/api";
import { clearSession, saveSession } from "@/lib/session";

export interface LoginState {
  error?: "invalid" | "unavailable";
  /** Echoed back so the email field keeps its value after an error. */
  email?: string;
}

const LOGIN = `
  mutation ($input: LoginInput!) {
    login(input: $input) { accessToken expiresAt }
  }`;

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const { login } = await graphqlRequest<{
      login: { accessToken: string; expiresAt: string };
    }>(LOGIN, { input: { email, password } });
    await saveSession(login.accessToken, new Date(login.expiresAt));
  } catch (error) {
    // Wrong credentials (or an empty or malformed email, which the API
    // rejects as BAD_REQUEST) get the same message, like the API itself.
    if (
      error instanceof ApiError &&
      ["UNAUTHENTICATED", "BAD_REQUEST"].includes(error.code)
    ) {
      return { error: "invalid", email };
    }
    // The API is down or answered something unexpected.
    console.error("Login failed", error);
    return { error: "unavailable", email };
  }

  // Outside the try: redirect() works by throwing, which the catch above
  // would otherwise swallow.
  redirect("/orders");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
