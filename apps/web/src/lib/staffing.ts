/**
 * Planning rules for the weekly staffing page, as plain functions.
 */

interface PlanningOrder {
  status: string;
  startDate: string;
  dueDate: string;
  vessel: { id: string };
  team: { id: string; name: string }[];
}

/**
 * The people on the teams of a vessel's orders that are still open in the
 * given week: everything not done whose period overlaps the week (Monday to
 * Sunday). Each person counts once, however many orders they are on.
 */
export function assignedFor(
  orders: PlanningOrder[],
  vesselId: string,
  weekStart: Date,
): { id: string; name: string }[] {
  const weekEnd = weekStart.getTime() + 7 * 86_400_000; // the next Monday
  const people = new Map<string, { id: string; name: string }>();
  for (const order of orders) {
    if (order.vessel.id !== vesselId || order.status === "DONE") continue;
    const overlaps =
      new Date(order.startDate).getTime() < weekEnd &&
      new Date(order.dueDate).getTime() >= weekStart.getTime();
    if (!overlaps) continue;
    for (const member of order.team) people.set(member.id, member);
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}

interface PlanningRequest {
  vessel: { id: string; name: string };
  requestedWorkers: { id: string; name: string }[];
}

/**
 * Workers asked for by name on more than one vessel in the same week. A
 * worker can't be in two places, so the project lead has to settle it.
 * Returns, per worker id, the vessels that asked for them (at least two).
 */
export function findDoubleBookings(
  requests: PlanningRequest[],
): Map<string, { id: string; name: string }[]> {
  const vesselsByWorker = new Map<string, { id: string; name: string }[]>();
  for (const request of requests) {
    for (const worker of request.requestedWorkers) {
      const vessels = vesselsByWorker.get(worker.id) ?? [];
      vessels.push(request.vessel);
      vesselsByWorker.set(worker.id, vessels);
    }
  }
  for (const [id, vessels] of vesselsByWorker) {
    if (vessels.length < 2) vesselsByWorker.delete(id);
  }
  return vesselsByWorker;
}

/** The other vessels a double-booked worker was asked for, besides this one. */
export function otherVessels(
  bookings: Map<string, { id: string; name: string }[]>,
  workerId: string,
  vesselId: string,
): string[] {
  return (bookings.get(workerId) ?? [])
    .filter((vessel) => vessel.id !== vesselId)
    .map((vessel) => vessel.name);
}
