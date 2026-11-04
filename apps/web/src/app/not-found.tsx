import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { StatusScreen, primaryAction } from "@/components/status-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("status");
  return { title: t("notFoundTitle") };
}

/**
 * Shown for URLs that match no page. "/" sends everyone to the start page of
 * their role, and to the login page without a session.
 */
export default async function NotFound() {
  const t = await getTranslations("status");
  return (
    <StatusScreen title={t("notFoundTitle")} message={t("notFoundMessage")}>
      <Link href="/" className={primaryAction}>
        {t("home")}
      </Link>
    </StatusScreen>
  );
}
