"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveRequest, type SaveRequestState } from "./actions";

const inputClass =
  "min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export interface StaffingDefaults {
  workersNeeded: number | null;
  workersActual: number | null;
  reportedBy: string;
  note: string;
  workerIds: string[];
}

/**
 * What the foreman asked for, for one vessel and one week. The project lead
 * fills it in; it starts from the week before, so keeping the same crew is
 * the default and only changes need typing.
 */
export function StaffingForm({
  vesselId,
  weekStart,
  workers,
  defaults,
  prefilled,
}: {
  vesselId: string;
  weekStart: string;
  workers: { id: string; name: string }[];
  defaults: StaffingDefaults;
  /** The defaults come from last week, not from a saved request. */
  prefilled: boolean;
}) {
  const t = useTranslations("planning");
  const [state, formAction, pending] = useActionState<
    SaveRequestState,
    FormData
  >(saveRequest.bind(null, vesselId, weekStart), {});
  const chosen = new Set(defaults.workerIds);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {prefilled && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t("prefilled")}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("workersNeeded")}
        <input
          name="workersNeeded"
          type="number"
          inputMode="numeric"
          required
          min={0}
          max={500}
          step={1}
          defaultValue={defaults.workersNeeded ?? undefined}
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">{t("byName")}</legend>
        <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t("byNameHint")}
        </p>
        {workers.map((worker) => (
          <label
            key={worker.id}
            className="flex min-h-11 items-center gap-3 text-sm"
          >
            <input
              className="size-5"
              type="checkbox"
              name="workerIds"
              value={worker.id}
              defaultChecked={chosen.has(worker.id)}
            />
            {worker.name}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("foreman")}
        <input
          name="reportedBy"
          maxLength={100}
          defaultValue={defaults.reportedBy}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("note")}
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          defaultValue={defaults.note}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("workersActual")}
        <input
          name="workersActual"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          step={1}
          defaultValue={defaults.workersActual ?? undefined}
          className={inputClass}
        />
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {t("workersActualHint")}
        </span>
      </label>

      {state.error && (
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
      )}
      {state.done && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("saved")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-sky-700 px-4 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
