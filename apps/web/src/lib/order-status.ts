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
 * Whether this user may update the order: its team members and project
 * leads, like the API's rule for status updates.
 */
export function canUpdateOrder(
  user: { id: string; role: "PROJECT_LEAD" | "WORKER" },
  team: readonly { id: string }[],
): boolean {
  return user.role === "PROJECT_LEAD" || team.some((m) => m.id === user.id);
}
