"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/server/api";
import { apiAsUser, requireUser } from "@/lib/server/dal";
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
  error?:
    | "forbidden"
    | "noteRequired"
    | "outdated"
    | "photosRejected"
    | "unavailable";
  /** Echoed back so the note keeps its text after an error. */
  note?: string;
}

const ADD_STATUS_UPDATE = `
  mutation ($input: AddStatusUpdateInput!) {
    addStatusUpdate(input: $input) { id }
  }`;

/**
 * Moves the order one step forward ("advance") or adds a note and/or photos
 * without changing the status ("note"). Photos are already uploaded by then
 * (see requestPhotoUploads); the form sends their storage keys as
 * `photoKey` fields. Bound to the order's id and the status the page showed:
 * `updateStatus.bind(null, order.id, order.status)`.
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
  const photoKeys = formData
    .getAll("photoKey")
    .filter((key): key is string => typeof key === "string" && key !== "");
  const advance = formData.get("intent") === "advance";
  const status = advance ? nextStatus(shownStatus) : shownStatus;
  // Nothing to advance to (already done), or an update without a status
  // change that has neither a note nor photos: the API would reject it too,
  // but this gives a clear message.
  if (!status || (!advance && !note && photoKeys.length === 0)) {
    return { error: "noteRequired", note };
  }

  try {
    await apiAsUser(ADD_STATUS_UPDATE, {
      input: { orderId, status, note: note || undefined, photoKeys },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") return { error: "forbidden", note };
      if (error.code === "BAD_REQUEST") {
        // The status isn't what the page showed: someone else moved the
        // order in the meantime. Otherwise it's the photos: the browser
        // checked type and size, so this is rare (e.g. an upload that
        // expired). The API's messages are for developers, not for the UI.
        const outdated = error.validationErrors.some((message) =>
          message.startsWith("Cannot change status"),
        );
        return { error: outdated ? "outdated" : "photosRejected", note };
      }
    }
    console.error("Updating the status failed", error);
    return { error: "unavailable", note };
  }

  revalidatePath(`/orders/${orderId}`);
  return {};
}

export type PhotoUploadsResult =
  | {
      targets: {
        storageKey: string;
        url: string;
        headers: { name: string; value: string }[];
      }[];
    }
  | { error: "forbidden" | "invalid" | "unavailable" };

const REQUEST_PHOTO_UPLOADS = `
  mutation ($input: RequestPhotoUploadsInput!) {
    requestPhotoUploads(input: $input) { storageKey url headers { name value } }
  }`;

/**
 * Step 1 of adding photos: asks the API for one signed upload URL per photo.
 * The browser then uploads straight to the storage, so the files never pass
 * through this server (Server Action bodies are capped at 1 MB anyway).
 *
 * Handing the URLs to the browser is fine: each one allows a single PUT of
 * that file, for a few minutes. The user's token stays on the server.
 */
export async function requestPhotoUploads(
  orderId: string,
  files: { mimeType: string; sizeBytes: number }[],
): Promise<PhotoUploadsResult> {
  await requireUser();
  // Only what the API needs, whatever the caller sent: this is a public
  // endpoint, like every Server Action.
  const input = {
    orderId: String(orderId),
    files: files.map((file) => ({
      mimeType: String(file.mimeType),
      sizeBytes: Number(file.sizeBytes),
    })),
  };
  try {
    const { requestPhotoUploads: targets } = await apiAsUser<{
      requestPhotoUploads: Extract<PhotoUploadsResult, { targets: unknown }>["targets"];
    }>(REQUEST_PHOTO_UPLOADS, { input });
    return { targets };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
        return { error: "forbidden" };
      }
      if (error.code === "BAD_REQUEST") return { error: "invalid" };
    }
    console.error("Requesting photo uploads failed", error);
    return { error: "unavailable" };
  }
}

const ASSIGN = `
  mutation ($orderId: ID!, $userId: ID!) {
    assignTeamMember(orderId: $orderId, userId: $userId) { id }
  }`;
const REMOVE = `
  mutation ($orderId: ID!, $userId: ID!) {
    removeTeamMember(orderId: $orderId, userId: $userId) { id }
  }`;

/**
 * Adds the person chosen in the form. For project leads, and team leads on
 * their own vessels; the API checks the vessel and the crew plan.
 */
export async function assignMember(orderId: string, formData: FormData) {
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD" && user.role !== "TEAM_LEAD") return;
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await apiAsUser(ASSIGN, { orderId, userId });
  revalidatePath(`/orders/${orderId}`);
}

/** Bound to the order and the person: `removeMember.bind(null, order.id, member.id)`. */
export async function removeMember(orderId: string, userId: string) {
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD" && user.role !== "TEAM_LEAD") return;
  await apiAsUser(REMOVE, { orderId, userId });
  revalidatePath(`/orders/${orderId}`);
}
