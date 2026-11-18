/**
 * Rules for the weekly crew plan (which worker is on which vessel), as plain
 * functions. The API decides what is allowed; these only shape the screen.
 */

interface Person {
  id: string;
  name: string;
}

export interface CrewRow {
  user: Person;
  vessel: Person;
}

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name);

/** The planned workers per vessel id, sorted by name. */
export function crewByVessel(plan: CrewRow[]): Map<string, Person[]> {
  const crews = new Map<string, Person[]>();
  for (const row of plan) {
    const crew = crews.get(row.vessel.id) ?? [];
    crew.push(row.user);
    crews.set(row.vessel.id, crew);
  }
  for (const crew of crews.values()) crew.sort(byName);
  return crews;
}

/**
 * The workers the team lead asked for by name who aren't on this vessel's
 * crew yet: what one tap on "plan the requested workers" adds.
 */
export function requestedNotPlanned(
  requested: Person[],
  crew: Person[],
): Person[] {
  const planned = new Set(crew.map((person) => person.id));
  return requested.filter((person) => !planned.has(person.id));
}

/**
 * The workers to offer on a vessel's "add" row: everyone who isn't on this
 * vessel, with the vessel they're on now (planning them here moves them).
 * Unplanned workers come first, because they're the obvious choice.
 */
export function addCandidates(
  workers: Person[],
  plan: CrewRow[],
  vesselId: string,
): { worker: Person; plannedOn: Person | null }[] {
  const vesselOf = new Map(plan.map((row) => [row.user.id, row.vessel]));
  return workers
    .filter((worker) => vesselOf.get(worker.id)?.id !== vesselId)
    .map((worker) => ({ worker, plannedOn: vesselOf.get(worker.id) ?? null }))
    .sort(
      (a, b) =>
        Number(a.plannedOn !== null) - Number(b.plannedOn !== null) ||
        byName(a.worker, b.worker),
    );
}

/** The workers planned on no vessel at all that week, by name. */
export function unplannedWorkers(workers: Person[], plan: CrewRow[]): Person[] {
  const planned = new Set(plan.map((row) => row.user.id));
  return workers.filter((worker) => !planned.has(worker.id)).sort(byName);
}

/**
 * How many more workers a vessel needs: what was requested minus who is
 * planned. Never negative; a vessel without a request needs nothing.
 */
export function stillNeeded(
  workersNeeded: number | undefined,
  crew: Person[],
): number {
  return Math.max(0, (workersNeeded ?? 0) - crew.length);
}

/**
 * Who a team lead can add to an order's team: the workers planned on the
 * order's vessel (this week or next, as the rows passed in), who work in
 * the order's service area and aren't on the team yet. Each person once.
 */
export function plannedCandidates(
  rows: { user: Person & { serviceTypes: string[] }; vessel: { id: string } }[],
  vesselId: string,
  serviceType: string,
  team: { id: string }[],
): Person[] {
  const onTeam = new Set(team.map((member) => member.id));
  const people = new Map<string, Person>();
  for (const { user, vessel } of rows) {
    if (vessel.id !== vesselId || onTeam.has(user.id)) continue;
    if (!user.serviceTypes.includes(serviceType)) continue;
    people.set(user.id, { id: user.id, name: user.name });
  }
  return [...people.values()].sort(byName);
}
