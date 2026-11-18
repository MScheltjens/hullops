"use client";

import { useTranslations } from "next-intl";
import { useActionState, type ReactNode } from "react";
import type { CrewActionState } from "./actions";

const styles = {
  // The main choice on a vessel card: plan everyone who was asked for.
  primary:
    "bg-sky-700 px-4 font-medium text-white hover:bg-sky-800 disabled:opacity-60",
  // A planned worker; tapping takes him off again.
  planned:
    "border border-emerald-300 bg-emerald-50 px-3 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900",
  // A worker who can be added.
  add: "border border-zinc-300 px-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900",
};

/**
 * One tap on the crew plan: a single button that runs a bound Server Action
 * (plan or unplan someone). It works without JavaScript too, as a plain form.
 */
export function CrewButton({
  action,
  variant,
  label,
  children,
}: {
  action: (
    previous: CrewActionState,
    formData: FormData,
  ) => Promise<CrewActionState>;
  variant: keyof typeof styles;
  /** Read out by screen readers when the visible text alone is unclear. */
  label?: string;
  children: ReactNode;
}) {
  const t = useTranslations("planning.crew");
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <button
        type="submit"
        disabled={pending}
        aria-label={label}
        className={`flex min-h-11 items-center gap-2 rounded-md text-sm ${styles[variant]}`}
      >
        {children}
      </button>
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
    </form>
  );
}
