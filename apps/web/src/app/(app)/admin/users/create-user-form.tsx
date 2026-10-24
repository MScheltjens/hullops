"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { createUser, type CreateUserState } from "./actions";

const inputClass =
  "min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const ROLES = ["WORKER", "PROJECT_LEAD", "ADMIN"] as const;
const SERVICE_TYPES = ["CLEANING", "PROTECTION"] as const;

export function CreateUserForm() {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState<
    CreateUserState,
    FormData
  >(createUser, {});

  // After an error React empties the form, so the fields refill themselves
  // from the values the action sent back (never the password).
  const value = (name: string) => {
    const v = state.values?.[name];
    return typeof v === "string" ? v : undefined;
  };
  const chosenAreas = new Set(state.values?.serviceTypes ?? []);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("name")}
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={value("name")}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("email")}
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          defaultValue={value("email")}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("password")}
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={200}
          autoComplete="new-password"
          className={inputClass}
        />
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {t("passwordHint")}
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("role")}
        <select
          name="role"
          defaultValue={value("role") ?? "WORKER"}
          className={inputClass}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">
          {t("serviceAreas")}
        </legend>
        {SERVICE_TYPES.map((type) => (
          <label key={type} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              className="size-5"
              type="checkbox"
              name="serviceTypes"
              value={type}
              defaultChecked={chosenAreas.has(type)}
            />
            {t(`serviceTypeNames.${type}`)}
          </label>
        ))}
      </fieldset>

      {state.error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          <p>{t(`errors.${state.error}`)}</p>
          {state.messages && (
            // The API's messages are in English: the API stays
            // language-neutral, so they're shown as they come.
            <ul className="mt-1 list-disc pl-5">
              {state.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-sky-700 px-4 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}
