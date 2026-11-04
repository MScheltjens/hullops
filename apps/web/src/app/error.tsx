"use client"; // Error boundaries are Client Components: `retry` runs in the browser.

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  StatusScreen,
  primaryAction,
  secondaryAction,
} from "@/components/status-screen";

/**
 * Shown when a page crashes, typically because the API can't be reached. This
 * one sits above (app)/layout.tsx, so it also catches that layout failing;
 * (app)/error.tsx shows the same screen with the header still in place.
 *
 * It deliberately ignores the `error` prop: in production Next.js replaces
 * the message of server errors with a generic one, so it says nothing useful.
 * The real error is in the server log.
 */
export default function ErrorPage({ retry }: { retry: () => void }) {
  const t = useTranslations("status");
  return (
    <StatusScreen title={t("errorTitle")} message={t("errorMessage")}>
      <button type="button" onClick={retry} className={primaryAction}>
        {t("retry")}
      </button>
      <Link href="/" className={secondaryAction}>
        {t("home")}
      </Link>
    </StatusScreen>
  );
}
