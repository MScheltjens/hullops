import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  // Already logged in (with a valid session): nothing to do here.
  if (await getCurrentUser()) redirect("/orders");

  const t = await getTranslations();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("common.appName")}
        </h1>
        <p className="mt-1 mb-8 text-sm text-zinc-600 dark:text-zinc-400">
          {t("common.tagline")}
        </p>
        <h2 className="mb-4 text-lg font-medium">{t("login.title")}</h2>
        <LoginForm />
      </div>
    </main>
  );
}
