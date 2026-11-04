import { getTranslations } from "next-intl/server";

/**
 * Shown right after tapping a link, while the server fetches the next page.
 * On a slow yard connection that's what tells people their tap worked.
 */
export default async function Loading() {
  const t = await getTranslations("status");
  return (
    <div role="status" className="flex justify-center py-16">
      <span
        aria-hidden
        className="size-8 animate-spin rounded-full border-4 border-zinc-200 border-t-sky-700 dark:border-zinc-800"
      />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
