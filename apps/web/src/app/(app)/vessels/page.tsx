import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { apiAsUser, requireUser } from "@/lib/dal";
import { CreateVesselForm } from "./create-vessel-form";

interface VesselRow {
  id: string;
  name: string;
  imoNumber: string | null;
  vesselType: string | null;
  lengthM: number | null;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("vessels");
  return { title: t("title") };
}

export default async function VesselsPage() {
  const user = await requireUser();
  const { vessels } = await apiAsUser<{ vessels: VesselRow[] }>(
    "{ vessels { id name imoNumber vesselType lengthM } }",
  );
  const t = await getTranslations("vessels");
  const format = await getFormatter();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      {/* Only project leads add vessels; the Server Action and the API check too. */}
      {user.role === "PROJECT_LEAD" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("add")}</h2>
          <CreateVesselForm />
        </section>
      )}

      {vessels.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {vessels.map((vessel) => (
            <li
              key={vessel.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="font-medium">{vessel.name}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {[
                  vessel.imoNumber ? `IMO ${vessel.imoNumber}` : null,
                  vessel.vesselType,
                  vessel.lengthM !== null
                    ? `${format.number(vessel.lengthM)} m`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || t("noDetails")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
