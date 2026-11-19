import type { Role } from "./user-roles";

/**
 * Rules about an order's status that the web app needs to decide what to
 * show. The API enforces the real rules (see order-rules.ts there); these
 * only keep the UI from offering buttons that would fail.
 */

/** The order in which an order's status moves. */
export const STATUS_FLOW = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
export type Status = (typeof STATUS_FLOW)[number];

/** A status an order can move *to*: every status except the first. */
export type ForwardStatus = Exclude<Status, "PLANNED">;

/** The status that follows, or undefined when the order is done. */
export function nextStatus(status: Status): ForwardStatus | undefined {
  // Only PLANNED is never "next", and nothing precedes it in the flow.
  return STATUS_FLOW[STATUS_FLOW.indexOf(status) + 1] as
    | ForwardStatus
    | undefined;
}

/**
 * Whether this user may change the order's team: project leads on every
 * order, a team lead on the orders of the vessels he leads. Same rule as the
 * API, which also checks that a team lead only adds planned workers.
 */
export function canChangeTeam(
  user: { id: string; role: Role },
  vessel: { teamLead: { id: string } | null },
): boolean {
  if (user.role === "PROJECT_LEAD") return true;
  return user.role === "TEAM_LEAD" && vessel.teamLead?.id === user.id;
}
