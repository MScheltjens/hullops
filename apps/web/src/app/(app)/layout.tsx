import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireUser } from "@/lib/server/dal";
import {
  canManageUsers,
  homePath,
  seesPlanning,
  seesWork,
} from "@/lib/user-roles";
import { PreferencesMenu } from "./preferences-menu";

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
        One row on every screen: the user's own settings sit behind one
        button (PreferencesMenu). The gaps are tight on a phone so that an
        administrator's four links fit at 390px, also in German; on a
        narrower phone the navigation scrolls sideways instead of wrapping.
      */}
      <header className="border-b border-zinc-200 bg-white pt-[env(safe-area-inset-top)] dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center gap-x-2.5 px-4 sm:gap-x-6">
          <Link
            href={homePath(user.role)}
            className="flex min-h-11 shrink-0 items-center text-base font-semibold tracking-tight sm:text-lg"
          >
            {t("common.appName")}
          </Link>
          <nav className="flex min-w-0 flex-1 gap-2.5 overflow-x-auto whitespace-nowrap sm:gap-5">
            {/* HR doesn't see the work; the API refuses it too. */}
            {seesWork(user.role) && (
              <>
            <Link
              href="/orders"
              className="flex min-h-11 items-center text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              {t("nav.orders")}
            </Link>
            <Link
              href="/vessels"
              className="flex min-h-11 items-center text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              {t("nav.vessels")}
            </Link>
            {/* Workers don't plan; the page and the API check too. */}
            {seesPlanning(user.role) && (
              <Link
                href="/planning"
                className="flex min-h-11 items-center text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                {t("nav.planning")}
              </Link>
            )}
              </>
            )}
            {/* Administrators and HR manage users; the page and the API check too. */}
            {canManageUsers(user.role) && (
              <Link
                href="/admin/users"
                className="flex min-h-11 items-center text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                {t("nav.users")}
              </Link>
            )}
          </nav>

          <PreferencesMenu user={user} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
        {children}
      </main>
    </>
  );
}
