"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/server/api";
import { apiAsUser, requireUser } from "@/lib/server/dal";
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
  // the page already hides the form. Whether a team lead may enter a request
  // for this vessel depends on the vessel, which the API checks.
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD" && user.role !== "TEAM_LEAD") {
    return { error: "forbidden" };
  }

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

export interface CrewActionState {
  error?: "forbidden" | "invalid" | "unavailable";
  /** What the API found wrong (in English), e.g. an inactive worker. */
  messages?: string[];
}

const PLAN_CREW = `
  mutation ($input: PlanCrewMembersInput!) {
    planCrewMembers(input: $input) { weekStart }
  }`;
const UNPLAN_CREW = `
  mutation ($week: String!, $userId: ID!) {
    unplanCrewMember(weekStart: $week, userId: $userId)
  }`;

/** Turns an API error from a crew change into what the button shows. */
function crewError(error: unknown, what: string): CrewActionState {
  if (error instanceof ApiError) {
    if (error.code === "FORBIDDEN") return { error: "forbidden" };
    if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") {
      return {
        error: "invalid",
        messages:
          error.validationErrors.length > 0
            ? error.validationErrors
            : [error.message],
      };
    }
  }
  console.error(what, error);
  return { error: "unavailable" };
}

/**
 * Puts workers on a vessel for the week; workers planned elsewhere move.
 * Bound in the page with everything it needs, so each button is one tap:
 * `planWorkers.bind(null, weekStart, vesselId, [workerId])`. The button's
 * form has no fields, so the action ignores useActionState's arguments.
 */
export async function planWorkers(
  weekStart: string,
  vesselId: string,
  userIds: string[],
): Promise<CrewActionState> {
  // A Server Action is a public endpoint, so check the role here too.
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return { error: "forbidden" };
  if (userIds.length === 0) return {};

  try {
    await apiAsUser(PLAN_CREW, { input: { weekStart, vesselId, userIds } });
  } catch (error) {
    return crewError(error, "Planning the crew failed");
  }
  revalidatePath("/planning");
  return {};
}

/** Takes a worker off the plan for the week: `unplanWorker.bind(null, weekStart, workerId)`. */
export async function unplanWorker(
  weekStart: string,
  userId: string,
): Promise<CrewActionState> {
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return { error: "forbidden" };

  try {
    await apiAsUser(UNPLAN_CREW, { week: weekStart, userId });
  } catch (error) {
    return crewError(error, "Taking a worker off the plan failed");
  }
  revalidatePath("/planning");
  return {};
}
