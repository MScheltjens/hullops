import { getTranslations } from "next-intl/server";
import type { CurrentUser } from "@/lib/server/dal";
import { USER_LOCALES } from "@/i18n/locales";
import { logout, setLocale } from "./actions";
import { PopoverA11y } from "@/components/popover-a11y";

const PANEL_ID = "preferences";
const BUTTON_ID = "preferences-button";

/**
 * The user's own settings (who is logged in, language, log out) behind one
 * button at the right of the header, so the header stays a single row on a
 * phone. On wider screens the button also shows the name and role.
 *
 * Built on the browser's popover (`popover` + `popovertarget`) instead of
 * our own menu code. The browser opens and closes it with the button,
 * closes it on Escape or a tap outside, and puts focus back on the button.
 * That works even without JavaScript, and the buttons inside are plain
 * Server Action forms, as before. PopoverA11y adds aria-expanded and moves
 * focus into the panel when it opens.
 *
 * This is the one exception to "no hidden menus" in docs/ux.md: personal
 * settings are rarely used and aren't part of the work.
 */
export async function PreferencesMenu({ user }: { user: CurrentUser }) {
  const t = await getTranslations("nav");
  const role = t(`roles.${user.role}`);

  return (
    <>
      <button
        id={BUTTON_ID}
        type="button"
        popoverTarget={PANEL_ID}
        aria-controls={PANEL_ID}
        aria-expanded={false}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <PersonIcon />
        {/* The label: "Settings" for screen readers, plus the name, which
            is also visible on wider screens. */}
        <span className="sr-only">{t("preferences")}</span>
        <span className="sr-only max-w-64 truncate sm:not-sr-only">
          {user.name} · {role}
        </span>
      </button>

      <div
        id={PANEL_ID}
        popover="auto"
        role="dialog"
        aria-label={t("preferences")}
        // A popover is centred by default; place it under the button.
        className="fixed inset-auto top-[calc(env(safe-area-inset-top)+3.25rem)] right-4 m-0 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-900 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium">{user.name}</div>
            <div className="text-zinc-600 dark:text-zinc-400">{role}</div>
          </div>
          <button
            type="button"
            popoverTarget={PANEL_ID}
            popoverTargetAction="hide"
            className="-mt-2 -mr-2 min-h-11 min-w-11 shrink-0 rounded-md text-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <span aria-hidden>×</span>
            <span className="sr-only">{t("close")}</span>
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-zinc-600 dark:text-zinc-400">
            {t("language")}
          </span>
          <div
            role="group"
            aria-label={t("language")}
            className="flex self-start overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700"
          >
            {USER_LOCALES.map((locale, i) => (
              <form key={locale} action={setLocale.bind(null, locale)}>
                <button
                  type="submit"
                  // Focus lands here when the menu opens (see PopoverA11y).
                  data-autofocus={i === 0 ? "" : undefined}
                  aria-pressed={user.locale === locale}
                  className="min-h-11 min-w-11 px-3 font-medium aria-pressed:bg-zinc-900 aria-pressed:text-white dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
                >
                  {locale}
                </button>
              </form>
            ))}
          </div>
        </div>

        <form
          action={logout}
          className="mt-4 border-t border-zinc-200 pt-2 dark:border-zinc-800"
        >
          <button
            type="submit"
            className="min-h-11 w-full rounded-md px-2 text-left font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {t("logout")}
          </button>
        </form>
      </div>
      <PopoverA11y panelId={PANEL_ID} buttonId={BUTTON_ID} />
    </>
  );
}

/** A person outline, drawn inline so the app needs no icon library. */
function PersonIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 shrink-0"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}
