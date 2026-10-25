"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { apiAsUser, requireUser } from "@/lib/dal";
import { buildSaveStaffingInput } from "@/lib/staffing-input";

export interface SaveRequestState {
  error?: "forbidden" | "incomplete" | "invalid" | "unavailable";
  /** What the API found wrong, one message per rule (in English). */
  messages?: string[];
  /** The request was saved; the form shows a short confirmation. */
  done?: boolean;
}

const SAVE_REQUEST = `
  mutation ($input: SaveStaffingRequestInput!) {
    saveStaffingRequest(input: $input) { id }
  }`;

/** Bound in the page: `saveRequest.bind(null, vessel.id, weekStart)`. */
export async function saveRequest(
  vesselId: string,
  weekStart: string,
  _previous: SaveRequestState,
  formData: FormData,
): Promise<SaveRequestState> {
  // A Server Action is a public endpoint: check the role here, even though
  // the page already hides the form. (The API checks it again.)
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return { error: "forbidden" };

  try {
    await apiAsUser(SAVE_REQUEST, {
      input: buildSaveStaffingInput(vesselId, weekStart, formData),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") return { error: "forbidden" };
      // The number of workers is missing: GraphQL rejects that before the
      // API's own validation runs.
      if (error.code === "BAD_USER_INPUT") return { error: "incomplete" };
      if (error.code === "BAD_REQUEST") {
        return {
          error: "invalid",
          messages:
            error.validationErrors.length > 0
              ? error.validationErrors
              : [error.message],
        };
      }
    }
    console.error("Saving a staffing request failed", error);
    return { error: "unavailable" };
  }

  revalidatePath("/planning");
  return { done: true };
}
