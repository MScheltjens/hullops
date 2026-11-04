"use client"; // Error boundaries are Client Components.

import "./globals.css";

/**
 * The last resort, for when the root layout itself crashes. It replaces that
 * layout, so it brings its own <html> and <body>, and there is no language or
 * translation provider. That's why the text is here, in both languages,
 * instead of in messages/*.json.
 */
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <title>HullOps</title>
        <div className="m-auto w-full max-w-sm px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p lang="de" className="mt-1 text-zinc-600 dark:text-zinc-400">
            Etwas ist schiefgelaufen
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-8 min-h-11 w-full rounded-md bg-sky-700 px-4 font-medium text-white hover:bg-sky-800"
          >
            Try again · Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
