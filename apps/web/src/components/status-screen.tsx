import type { ReactNode } from "react";

/** The shared look of the "not found" and "something went wrong" pages. */
export function StatusScreen({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  /** The way out: a link or button, so nobody is left at a dead end. */
  children: ReactNode;
}) {
  return (
    // m-auto centers this in the body on full-page screens, and horizontally
    // inside the app's <main>.
    <div className="m-auto w-full max-w-sm px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">{message}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/** Styles for the main action on these screens, for both <Link> and <button>. */
export const primaryAction =
  "flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-4 font-medium text-white hover:bg-sky-800";

export const secondaryAction =
  "flex min-h-11 items-center justify-center rounded-md px-4 font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white";
