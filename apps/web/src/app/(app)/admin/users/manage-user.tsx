"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  resetPassword,
  updateUser,
  type ManageUserState,
} from "./actions";

const inputClass =
  "min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const buttonClass =
  "min-h-11 self-start rounded-md bg-sky-700 px-4 font-medium text-white hover:bg-sky-800 disabled:opacity-60";

const ROLES = ["WORKER", "PROJECT_LEAD", "ADMIN"] as const;
const SERVICE_TYPES = ["CLEANING", "PROTECTION"] as const;

/** The result line under a form: an error with the API's messages, or "done". */
function Result({
  state,
  doneText,
}: {
  state: ManageUserState;
  doneText: string;
}) {
  const t = useTranslations("admin");
  if (state.error) {
    return (
      <div
        role="alert"
        className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
      >
        <p>{t(`errors.${state.error}`)}</p>
        {state.messages && (
          // The API's messages are in English: the API stays language-neutral.
          <ul className="mt-1 list-disc pl-5">
            {state.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (state.done) {
    return (
      <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
        {doneText}
      </p>
    );
  }
  return null;
}

/** Name, role and service areas of one user. */
export function EditUserForm({
  userId,
  name,
  role,
  serviceTypes,
  isMe,
}: {
  userId: string;
  name: string;
  role: (typeof ROLES)[number];
  serviceTypes: string[];
  /** You can't change your own role, so the role field is left out. */
  isMe: boolean;
}) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState<
    ManageUserState,
    FormData
  >(updateUser.bind(null, userId), {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("name")}
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={name}
          className={inputClass}
        />
      </label>
      {isMe ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("yourOwnRole")}
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("role")}
          <select name="role" defaultValue={role} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{t("serviceAreas")}</legend>
        {SERVICE_TYPES.map((type) => (
          <label key={type} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              className="size-5"
              type="checkbox"
              name="serviceTypes"
              value={type}
              defaultChecked={serviceTypes.includes(type)}
            />
            {t(`serviceTypeNames.${type}`)}
          </label>
        ))}
      </fieldset>
      <Result state={state} doneText={t("saved")} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}

/** Sets a new password for one user. */
export function ResetPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState<
    ManageUserState,
    FormData
  >(resetPassword.bind(null, userId), {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("newPassword")}
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
      <Result state={state} doneText={t("passwordChanged")} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? t("saving") : t("setPassword")}
      </button>
    </form>
  );
}
