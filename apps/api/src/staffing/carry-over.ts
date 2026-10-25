/**
 * Automatic weekly planning (see docs/ux.md): carries last week's staffing
 * requests over to the coming week.
 *
 * This is a *pure function*: plain data in, plain data out. It doesn't talk
 * to the database and doesn't know about Nest, so it is easy to test and
 * easy to reason about. Whatever calls it (a weekly job, a button) loads the
 * data first and saves the result afterwards.
 */

/** What a vessel's team lead asked for last week. */
export interface PreviousRequest {
  vesselId: string;
  /** Workers needed in total, including the ones asked for by name. */
  workersNeeded: number;
  /** The workers asked for by name. */
  workerIds: string[];
}

/** A request the app should create for the coming week. */
export interface PlannedRequest {
  vesselId: string;
  workersNeeded: number;
  workerIds: string[];
}

export interface CarryOverInput {
  /** Last week's requests, one per vessel. */
  previousWeek: PreviousRequest[];
  /** Vessels that already have a request for the coming week. */
  vesselsWithRequest: ReadonlySet<string>;
  /**
   * Workers who can be planned in the coming week: active workers who are
   * not away. The caller works that out, so this function stays simple.
   */
  availableWorkerIds: ReadonlySet<string>;
}

export function carryOver(input: CarryOverInput): PlannedRequest[] {
  return input.previousWeek
    .filter((request) => !input.vesselsWithRequest.has(request.vesselId))
    .map((request) => ({
      vesselId: request.vesselId,
      // The total stays the same, so a missing worker shows up as "1 more needed".
      workersNeeded: request.workersNeeded,
      workerIds: request.workerIds.filter((id) =>
        input.availableWorkerIds.has(id),
      ),
    }));
}
