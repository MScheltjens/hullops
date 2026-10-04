"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const t = useTranslations("login");
  // The form posts to the login Server Action. While it runs, `pending` is
  // true; afterwards `state` holds any error it returned.
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("email")}
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("password")}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {t(state.error)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
