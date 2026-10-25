import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { apiAsUser, requireUser } from "@/lib/dal";
import {
  assignedFor,
  findDoubleBookings,
  otherVessels,
} from "@/lib/staffing";
import { addWeeks, isoWeek, parseWeekParam, toDateOnly } from "@/lib/week";
import { StaffingForm, type StaffingDefaults } from "./staffing-form";

interface Person {
  id: string;
  name: string;
}
interface RequestRow {
  vessel: { id: string; name: string };
  workersNeeded: number;
  workersActual: number | null;
  reportedBy: string | null;
  note: string | null;
  requestedWorkers: Person[];
}

const REQUESTS = `
  query ($week: String!) {
    staffingRequests(weekStart: $week) {
      vessel { id name }
      workersNeeded workersActual reportedBy note
      requestedWorkers { id name }
    }
  }`;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("planning");
  return { title: t("title") };
}

export default async function PlanningPage({
  searchParams,
}: PageProps<"/planning">) {
  const user = await requireUser();
  const params = await searchParams;
  const week = parseWeekParam(params.week, new Date());
  const weekStart = toDateOnly(week);
  const previousWeek = toDateOnly(addWeeks(week, -1));

  const [{ vessels }, current, previous, { users }, { orders }] =
    await Promise.all([
      apiAsUser<{ vessels: Person[] }>("{ vessels { id name } }"),
      apiAsUser<{ staffingRequests: RequestRow[] }>(REQUESTS, {
        week: weekStart,
      }),
      apiAsUser<{ staffingRequests: RequestRow[] }>(REQUESTS, {
        week: previousWeek,
      }),
      apiAsUser<{ users: Person[] }>("{ users(role: WORKER) { id name } }"),
      apiAsUser<{
        orders: {
          status: string;
          startDate: string;
          dueDate: string;
          vessel: { id: string };
          team: Person[];
        }[];
      }>(
        `{ orders(take: 100) {
          status startDate dueDate vessel { id } team { id name }
        } }`,
      ),
    ]);

  const t = await getTranslations("planning");
  const format = await getFormatter();
  const day = (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC" });
  const lastDay = new Date(week.getTime() + 6 * 86_400_000);
  const isLead = user.role === "PROJECT_LEAD";

  const requestByVessel = new Map(
    current.staffingRequests.map((r) => [r.vessel.id, r]),
  );
  const previousByVessel = new Map(
    previous.staffingRequests.map((r) => [r.vessel.id, r]),
  );
  const doubleBookings = findDoubleBookings(current.staffingRequests);

  const nav =
    "flex min-h-11 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/planning?week=${previousWeek}`} className={nav}>
          ← {t("previousWeek")}
        </Link>
        <div className="font-medium">
          {t("week", { number: isoWeek(week) })}{" "}
          <span className="font-normal text-zinc-600 dark:text-zinc-400">
            {day(week)} – {day(lastDay)}
          </span>
        </div>
        <Link
          href={`/planning?week=${toDateOnly(addWeeks(week, 1))}`}
          className={nav}
        >
          {t("nextWeek")} →
        </Link>
      </div>

      {vessels.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {t("noVessels")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {vessels.map((vessel) => {
            const request = requestByVessel.get(vessel.id);
            const last = previousByVessel.get(vessel.id);
            const assigned = assignedFor(orders, vessel.id, week);
            // Prefill from this week's request, else from last week's.
            const source = request ?? last;
            const defaults: StaffingDefaults = {
              workersNeeded: source?.workersNeeded ?? null,
              // What actually worked is only known afterwards.
              workersActual: request?.workersActual ?? null,
              reportedBy: source?.reportedBy ?? "",
              note: request?.note ?? "",
              workerIds: source?.requestedWorkers.map((w) => w.id) ?? [],
            };
            const gap = request ? request.workersNeeded - assigned.length : 0;

            return (
              <li
                key={vessel.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="font-medium">{vessel.name}</div>

                {request ? (
                  <div className="mt-1 flex flex-col gap-1 text-sm">
                    <div>
                      {t("requested", { count: request.workersNeeded })}
                      {request.requestedWorkers.length > 0 &&
                        ` · ${t("namedCount", { count: request.requestedWorkers.length })}`}
                      {request.reportedBy && (
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {" · "}
                          {t("foremanIs", { name: request.reportedBy })}
                        </span>
                      )}
                    </div>
                    {request.requestedWorkers.length > 0 && (
                      <div className="text-zinc-700 dark:text-zinc-300">
                        {request.requestedWorkers.map((w, i) => (
                          <span key={w.id}>
                            {i > 0 && ", "}
                            {w.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {request.requestedWorkers
                      .filter((w) => doubleBookings.has(w.id))
                      .map((w) => (
                        <div
                          key={w.id}
                          role="alert"
                          className="rounded bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        >
                          {t("doubleBooked", {
                            name: w.name,
                            vessels: otherVessels(
                              doubleBookings,
                              w.id,
                              vessel.id,
                            ).join(", "),
                          })}
                        </div>
                      ))}
                    <div className="text-zinc-600 dark:text-zinc-400">
                      {t("onOrders", { count: assigned.length })}
                      {gap > 0 && (
                        <span className="ml-2 font-medium text-red-700 dark:text-red-400">
                          {t("short", { count: gap })}
                        </span>
                      )}
                    </div>
                    {request.workersActual !== null && (
                      <div className="text-zinc-600 dark:text-zinc-400">
                        {t("actual", { count: request.workersActual })}
                      </div>
                    )}
                    {request.note && (
                      <div className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">
                        {request.note}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500 italic dark:text-zinc-400">
                    {t("noRequest")}
                    {assigned.length > 0 &&
                      ` · ${t("onOrders", { count: assigned.length })}`}
                  </p>
                )}

                {/* Only project leads enter requests; the API checks too. */}
                {isLead && (
                  <details className="mt-3">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-sky-700 dark:text-sky-400">
                      {request ? t("edit") : t("enter")}
                    </summary>
                    <div className="mt-2">
                      {/* The key restarts the form with the saved values. */}
                      <StaffingForm
                        key={JSON.stringify(defaults)}
                        vesselId={vessel.id}
                        weekStart={weekStart}
                        workers={users}
                        defaults={defaults}
                        prefilled={!request && !!last}
                      />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
