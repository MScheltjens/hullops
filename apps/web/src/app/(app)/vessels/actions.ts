"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { apiAsUser, requireUser } from "@/lib/dal";
import { echoValues } from "@/lib/order-input";
import { buildCreateVesselInput } from "@/lib/vessel-input";

export interface CreateVesselState {
  error?: "forbidden" | "conflict" | "invalid" | "unavailable";
  /** What the API found wrong, one message per rule (in English). */
  messages?: string[];
  /** The submitted values, so the form keeps them after an error. */
  values?: Record<string, string | string[]>;
}

const CREATE_VESSEL = `
  mutation ($input: CreateVesselInput!) {
    createVessel(input: $input) { id }
  }`;

export async function createVessel(
  _previous: CreateVesselState,
  formData: FormData,
): Promise<CreateVesselState> {
  // A Server Action is a public endpoint: check the role here, even though
  // the page already hides the form. (The API checks it again.)
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return { error: "forbidden" };

  const values = echoValues(formData);
  try {
    await apiAsUser(CREATE_VESSEL, { input: buildCreateVesselInput(formData) });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") return { error: "forbidden", values };
      if (error.code === "CONFLICT") return { error: "conflict", values };
      // A missing name: GraphQL rejects it before the API's own validation.
      if (error.code === "BAD_USER_INPUT") return { error: "invalid", values };
      if (error.code === "BAD_REQUEST") {
        return {
          error: "invalid",
          messages:
            error.validationErrors.length > 0
              ? error.validationErrors
              : [error.message],
          values,
        };
      }
    }
    console.error("Creating a vessel failed", error);
    return { error: "unavailable", values };
  }

  revalidatePath("/vessels");
  return {};
}

const SET_TEAM_LEAD = `
  mutation ($vesselId: ID!, $userId: ID) {
    setVesselTeamLead(vesselId: $vesselId, userId: $userId) { id }
  }`;

/**
 * Chooses the team lead responsible for a vessel; an empty choice clears it.
 * Bound in the page: `setTeamLead.bind(null, vessel.id)`.
 */
export async function setTeamLead(vesselId: string, formData: FormData) {
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return;
  const userId = String(formData.get("userId") ?? "");
  await apiAsUser(SET_TEAM_LEAD, { vesselId, userId: userId || null });
  revalidatePath("/vessels");
  revalidatePath("/planning");
}
