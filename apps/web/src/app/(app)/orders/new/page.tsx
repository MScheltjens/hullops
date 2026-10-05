import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiAsUser, requireUser } from "@/lib/dal";
import { OrderForm, type VesselOption } from "./order-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orderForm");
  return { title: t("pageTitle") };
}

export default async function NewOrderPage() {
  const user = await requireUser();
  // Only project leads create orders. This just spares workers a form that
  // would fail: the API and the Server Action enforce the rule.
  if (user.role !== "PROJECT_LEAD") redirect("/orders");

  const { vessels } = await apiAsUser<{ vessels: VesselOption[] }>(
    "{ vessels { id name imoNumber } }",
  );
  const t = await getTranslations("orderForm");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("pageTitle")}
      </h1>
      {vessels.length === 0 ? (
        // The web app can't create vessels yet, so an empty list is a dead end.
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {t("noVessels")}{" "}
          <Link href="/orders" className="underline">
            {t("cancel")}
          </Link>
        </p>
      ) : (
        <OrderForm vessels={vessels} />
      )}
    </div>
  );
}
