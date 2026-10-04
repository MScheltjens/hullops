import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireUser, type Locale } from "@/lib/dal";
import { logout } from "../login/actions";
import { setLocale } from "./actions";

/**
 * The shell around every page that needs login. The "(app)" folder is a
 * route group: it groups these pages under one layout without adding
 * "/app" to their URLs.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const t = await getTranslations();

  return (
    <>
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/orders" className="text-lg font-semibold tracking-tight">
            {t("common.appName")}
          </Link>
          <nav className="flex-1">
            <Link
              href="/orders"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              {t("nav.orders")}
            </Link>
          </nav>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {user.name} · {t(`nav.roles.${user.role}`)}
            </span>

            <div
              role="group"
              aria-label={t("nav.language")}
              className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700"
            >
              {(["EN", "DE"] satisfies Locale[]).map((locale) => (
                <form key={locale} action={setLocale.bind(null, locale)}>
                  <button
                    type="submit"
                    aria-pressed={user.locale === locale}
                    className="px-2 py-1 text-xs font-medium aria-pressed:bg-zinc-900 aria-pressed:text-white dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
                  >
                    {locale}
                  </button>
                </form>
              ))}
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                {t("nav.logout")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}
