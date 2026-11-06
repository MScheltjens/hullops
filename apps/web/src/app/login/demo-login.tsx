"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { Role } from "@/lib/user-roles";
import { demoLogin, type LoginState } from "./actions";

/**
 * One button per role, for people trying the public demo. Only shown with
 * DEMO_MODE on (see page.tsx). The roles come in as a prop because the module
 * that lists them also holds the login details, which must stay on the server.
 */
export function DemoLogin({ roles }: { roles: readonly Role[] }) {
  const t = useTranslations("login");
  const roleLabels = useTranslations("admin.roles");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    demoLogin,
    {},
  );

  return (
    <section className="mb-8 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
      <h2 className="text-lg font-medium">{t("demoTitle")}</h2>
      <p className="mt-1 mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t("demoHint")}
      </p>
      <form action={formAction} className="grid grid-cols-2 gap-2">
        {roles.map((role, index) => (
          <button
            key={role}
            type="submit"
            name="role"
            value={role}
            disabled={pending}
            className={`min-h-11 rounded-md px-3 text-sm font-medium disabled:opacity-60 ${
              index === 0
                ? "col-span-2 bg-sky-700 text-white hover:bg-sky-800"
                : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {roleLabels(role)}
          </button>
        ))}
      </form>
      {state.error && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {t(state.error)}
        </p>
      )}
    </section>
  );
}
