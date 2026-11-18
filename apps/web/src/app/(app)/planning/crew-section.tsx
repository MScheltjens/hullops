import { getTranslations } from "next-intl/server";
import { addCandidates, requestedNotPlanned, stillNeeded } from "@/lib/crew";
import type { CrewRow } from "@/lib/crew";
import { planWorkers, unplanWorker } from "./actions";
import { CrewButton } from "./crew-button";

interface Person {
  id: string;
  name: string;
}

/**
 * Who the project lead put on this vessel for the week. A project lead plans
 * by tapping: one button plans everyone the team lead asked for by name, a
 * planned worker's button takes him off, and the other workers can be added
 * (a worker on another vessel is moved). Everyone else only reads the crew;
 * the team lead uses it to hand out the orders.
 */
export async function CrewSection({
  vessel,
  weekStart,
  crew,
  plan,
  workers,
  request,
  canPlan,
}: {
  vessel: Person;
  weekStart: string;
  crew: Person[];
  /** The whole week's plan, to say where other workers are now. */
  plan: CrewRow[];
  workers: Person[];
  request: { workersNeeded: number; requestedWorkers: Person[] } | undefined;
  canPlan: boolean;
}) {
  const t = await getTranslations("planning.crew");
  const missing = stillNeeded(request?.workersNeeded, crew);
  const toPlan = request
    ? requestedNotPlanned(request.requestedWorkers, crew)
    : [];
  const candidates = canPlan ? addCandidates(workers, plan, vessel.id) : [];

  return (
    <section
      aria-label={t("title")}
      className="mt-3 flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800"
    >
      <div className="text-sm">
        <span className="font-medium">{t("title")}</span>
        {" · "}
        {t("count", { count: crew.length })}
        {missing > 0 && (
          <span className="ml-2 font-medium text-red-700 dark:text-red-400">
            {t("short", { count: missing })}
          </span>
        )}
      </div>

      {crew.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {crew.map((person) => (
            <li key={person.id}>
              {canPlan ? (
                <CrewButton
                  variant="planned"
                  label={t("remove", { name: person.name })}
                  action={unplanWorker.bind(null, weekStart, person.id)}
                >
                  {person.name} <span aria-hidden>×</span>
                </CrewButton>
              ) : (
                <span className="flex min-h-11 items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
                  {person.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canPlan && toPlan.length > 0 && (
        <div className="self-start">
          <CrewButton
            variant="primary"
            action={planWorkers.bind(
              null,
              weekStart,
              vessel.id,
              toPlan.map((person) => person.id),
            )}
          >
            {t("planRequested", { count: toPlan.length })}
          </CrewButton>
        </div>
      )}

      {canPlan && candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("add")}
          </div>
          <ul className="flex flex-wrap gap-2">
            {candidates.map(({ worker, plannedOn }) => (
              <li key={worker.id}>
                <CrewButton
                  variant="add"
                  action={planWorkers.bind(null, weekStart, vessel.id, [
                    worker.id,
                  ])}
                >
                  <span aria-hidden>+</span> {worker.name}
                  {plannedOn && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t("onVessel", { vessel: plannedOn.name })}
                    </span>
                  )}
                </CrewButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
