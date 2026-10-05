"use server";

import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { apiAsUser, requireUser } from "@/lib/dal";
import { buildCreateOrderInput, echoValues } from "@/lib/order-input";

export interface CreateOrderState {
  error?: "forbidden" | "incomplete" | "invalid" | "unavailable";
  /** What the API found wrong, one message per violated rule (in English). */
  messages?: string[];
  /** The submitted values, so the form keeps them after an error. */
  values?: Record<string, string | string[]>;
}

const CREATE_ORDER = `
  mutation ($input: CreateOrderInput!) {
    createOrder(input: $input) { id }
  }`;

export async function createOrder(
  _previous: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  // A Server Action is a public endpoint: check the permission here, even
  // though the page already hides the form. (The API checks it again.)
  const user = await requireUser();
  if (user.role !== "PROJECT_LEAD") return { error: "forbidden" };

  const values = echoValues(formData);
  try {
    await apiAsUser(CREATE_ORDER, { input: buildCreateOrderInput(formData) });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") return { error: "forbidden", values };
      // A required field is missing: GraphQL rejects this before the API's
      // own validation runs. The browser's `required` attributes normally
      // prevent it; its technical message isn't worth showing.
      if (error.code === "BAD_USER_INPUT") return { error: "incomplete", values };
      if (error.code === "BAD_REQUEST") {
        return {
          error: "invalid",
          // Field-level rules (class-validator) arrive as validationErrors,
          // cross-field rules (order-rules.ts) as the message itself.
          messages:
            error.validationErrors.length > 0
              ? error.validationErrors
              : [error.message],
          values,
        };
      }
    }
    // The API is down or answered something unexpected. (apiAsUser's own
    // redirect to /login for an expired session is not an ApiError, so it
    // passes through here untouched.)
    console.error("Creating an order failed", error);
    return { error: "unavailable", values };
  }

  // Outside the try: redirect() works by throwing.
  redirect("/orders");
}
