"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { addComment, type AddCommentState } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function CommentForm({ orderId }: { orderId: string }) {
  const t = useTranslations("comments");
  const [state, formAction, pending] = useActionState<
    AddCommentState,
    FormData
  >(addComment.bind(null, orderId), {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("text")}
        <textarea
          name="text"
          required
          rows={4}
          maxLength={4000}
          defaultValue={state.text}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("source")}
        <input
          name="source"
          maxLength={200}
          defaultValue={state.source}
          className={inputClass}
        />
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {t("sourceHint")}
        </span>
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {t(`errors.${state.error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
