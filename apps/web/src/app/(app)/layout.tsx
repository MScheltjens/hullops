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
      {/*
        Mobile first: the base styles are for a phone, `sm:` adds the wider
        layout. Everything tappable is at least 44px high (min-h-11), the size
        Apple and Google recommend for fingers, also with work gloves.
      */}
      <header className="border-b border-zinc-200 bg-white pt-[env(safe-area-inset-top)] dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4">
          <Link
            href="/orders"
            className="flex min-h-11 items-center text-lg font-semibold tracking-tight"
          >
            {t("common.appName")}
          </Link>
          <nav className="flex-1">
            <Link
              href="/orders"
              className="flex min-h-11 items-center text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              {t("nav.orders")}
            </Link>
          </nav>

          {/* On a phone this wraps onto its own row, below the logo and nav. */}
          <div className="flex w-full items-center justify-between gap-4 pb-2 text-sm sm:w-auto sm:pb-0">
            <span className="truncate text-zinc-600 dark:text-zinc-400">
              {user.name} · {t(`nav.roles.${user.role}`)}
            </span>

            <div className="flex shrink-0 items-center gap-3">
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
                      className="min-h-11 min-w-11 px-3 text-sm font-medium aria-pressed:bg-zinc-900 aria-pressed:text-white dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
                    >
                      {locale}
                    </button>
                  </form>
                ))}
              </div>

              <form action={logout}>
                <button
                  type="submit"
                  className="min-h-11 px-1 font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
                >
                  {t("nav.logout")}
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
        {children}
      </main>
    </>
  );
}
