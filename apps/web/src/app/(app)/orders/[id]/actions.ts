"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { apiAsUser, requireUser } from "@/lib/dal";
import { nextStatus, type Status } from "@/lib/order-status";

export interface AddCommentState {
  error?: "forbidden" | "invalid" | "unavailable";
  /** Echoed back so the fields keep their text after an error. */
  text?: string;
  source?: string;
}

const ADD_COMMENT = `
  mutation ($input: AddOrderCommentInput!) {
    addOrderComment(input: $input) { id }
  }`;

/** Bound to the order's id in the form: `addComment.bind(null, order.id)`. */
export async function addComment(
  orderId: string,
  _previous: AddCommentState,
  formData: FormData,
): Promise<AddCommentState> {
  // A Server Action is a public endpoint: check the permission here, even
  // though the page only shows the form to project leads. (The API checks too.)
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return { error: "forbidden" };

  const text = String(formData.get("text") ?? "");
  const source = String(formData.get("source") ?? "");
  try {
    await apiAsUser(ADD_COMMENT, { input: { orderId, text, source } });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") return { error: "forbidden", text, source };
      // An empty or too long text: the API's message is for developers.
      if (error.code === "BAD_REQUEST") return { error: "invalid", text, source };
    }
    console.error("Adding a comment failed", error);
    return { error: "unavailable", text, source };
  }

  // Shows the new comment. The returned state is empty, which also empties
  // the form.
  revalidatePath(`/orders/${orderId}`);
  return {};
}

export interface UpdateStatusState {
  error?: "forbidden" | "noteRequired" | "outdated" | "unavailable";
  /** Echoed back so the note keeps its text after an error. */
  note?: string;
}

const ADD_STATUS_UPDATE = `
  mutation ($input: AddStatusUpdateInput!) {
    addStatusUpdate(input: $input) { id }
  }`;

/**
 * Moves the order one step forward ("advance") or adds a note without
 * changing the status ("note"). Bound to the order's id and the status the
 * page showed: `updateStatus.bind(null, order.id, order.status)`.
 */
export async function updateStatus(
  orderId: string,
  shownStatus: Status,
  _previous: UpdateStatusState,
  formData: FormData,
): Promise<UpdateStatusState> {
  // Who may update depends on the order's team, so the API decides; this
  // only makes sure someone is logged in.
  await requireUser();

  const note = String(formData.get("note") ?? "").trim();
  const advance = formData.get("intent") === "advance";
  const status = advance ? nextStatus(shownStatus) : shownStatus;
  // Nothing to advance to (already done), or a note-only update without a
  // note: the API would reject it too, but this gives a clear message.
  if (!status || (!advance && !note)) {
    return { error: "noteRequired", note };
  }

  try {
    await apiAsUser(ADD_STATUS_UPDATE, {
      input: { orderId, status, note: note || undefined },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") return { error: "forbidden", note };
      // The status isn't what the page showed: someone else moved the order
      // in the meantime.
      if (error.code === "BAD_REQUEST") return { error: "outdated", note };
    }
    console.error("Updating the status failed", error);
    return { error: "unavailable", note };
  }

  revalidatePath(`/orders/${orderId}`);
  return {};
}

const ASSIGN = `
  mutation ($orderId: ID!, $userId: ID!) {
    assignTeamMember(orderId: $orderId, userId: $userId) { id }
  }`;
const REMOVE = `
  mutation ($orderId: ID!, $userId: ID!) {
    removeTeamMember(orderId: $orderId, userId: $userId) { id }
  }`;

/** Adds the person chosen in the form. Project leads only (the API checks too). */
export async function assignMember(orderId: string, formData: FormData) {
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return;
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await apiAsUser(ASSIGN, { orderId, userId });
  revalidatePath(`/orders/${orderId}`);
}

/** Bound to the order and the person: `removeMember.bind(null, order.id, member.id)`. */
export async function removeMember(orderId: string, userId: string) {
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return;
  await apiAsUser(REMOVE, { orderId, userId });
  revalidatePath(`/orders/${orderId}`);
}
