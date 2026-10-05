"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { ForwardStatus, Status } from "@/lib/order-status";
import { updateStatus, type UpdateStatusState } from "./actions";

const inputClass =
  "min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

/**
 * The buttons a team member uses on site: move the order one step forward,
 * or leave a note. `next` is undefined once the order is done.
 */
export function StatusActions({
  orderId,
  status,
  next,
}: {
  orderId: string;
  status: Status;
  next: ForwardStatus | undefined;
}) {
  const t = useTranslations("statusActions");
  const [state, formAction, pending] = useActionState<
    UpdateStatusState,
    FormData
  >(updateStatus.bind(null, orderId, status), {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("note")}
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={state.note}
          className={inputClass}
        />
        {next && (
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            {t("noteHint")}
          </span>
        )}
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {t(`errors.${state.error}`)}
        </p>
      )}

      {/* Big, full-width buttons on a phone; side by side from sm up. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {next && (
          <button
            type="submit"
            name="intent"
            value="advance"
            disabled={pending}
            onClick={(event) => {
              // Done can't be undone, and a thumb slips: ask first.
              if (next === "DONE" && !confirm(t("confirmDone"))) {
                event.preventDefault();
              }
            }}
            className="min-h-12 rounded-md bg-sky-700 px-5 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {pending ? t("saving") : t(`advance.${next}`)}
          </button>
        )}
        <button
          type="submit"
          name="intent"
          value="note"
          disabled={pending}
          className="min-h-12 rounded-md border border-zinc-300 px-5 font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {t("addNote")}
        </button>
      </div>
    </form>
  );
}
