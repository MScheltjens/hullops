"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { createVessel, type CreateVesselState } from "./actions";

const inputClass =
  "min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function CreateVesselForm() {
  const t = useTranslations("vessels");
  const [state, formAction, pending] = useActionState<
    CreateVesselState,
    FormData
  >(createVessel, {});

  // After an error React empties the form, so the fields refill themselves
  // from the values the action sent back.
  const value = (name: string) => {
    const v = state.values?.[name];
    return typeof v === "string" ? v : undefined;
  };

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("name")}
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={value("name")}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("imoNumber")}
        <input
          name="imoNumber"
          inputMode="numeric"
          maxLength={7}
          defaultValue={value("imoNumber")}
          className={inputClass}
        />
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {t("imoHint")}
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("vesselType")}
        <input
          name="vesselType"
          maxLength={100}
          defaultValue={value("vesselType")}
          className={inputClass}
        />
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {t("vesselTypeHint")}
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("lengthM")}
        <input
          name="lengthM"
          type="number"
          min={0}
          step="any"
          defaultValue={value("lengthM")}
          className={inputClass}
        />
      </label>

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
