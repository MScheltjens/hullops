"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { apiAsUser, requireUser } from "@/lib/dal";
import { echoValues } from "@/lib/order-input";
import {
  buildCreateUserInput,
  buildResetPasswordInput,
  buildUpdateUserInput,
} from "@/lib/user-input";

export interface CreateUserState {
  error?: "forbidden" | "conflict" | "invalid" | "unavailable";
  /** What the API found wrong, one message per rule (in English). */
  messages?: string[];
  /** The submitted values, so the form keeps them after an error. */
  values?: Record<string, string | string[]>;
}

const CREATE_USER = `
  mutation ($input: CreateUserInput!) {
    createUser(input: $input) { id }
  }`;

export async function createUser(
  _previous: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  // A Server Action is a public endpoint: check the role here, even though
  // the page already hides the form. (The API checks it again.)
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "forbidden" };

  // Never send a password back to the browser, not even to refill the form.
  const values = echoValues(formData);
  delete values.password;
  try {
    await apiAsUser(CREATE_USER, { input: buildCreateUserInput(formData) });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") return { error: "forbidden", values };
      if (error.code === "CONFLICT") return { error: "conflict", values };
      // Missing required fields: GraphQL rejects those before the API's own
      // validation runs, and its message is for developers.
      if (error.code === "BAD_USER_INPUT") {
        return { error: "invalid", values };
      }
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
    console.error("Creating a user failed", error);
    return { error: "unavailable", values };
  }

  revalidatePath("/admin/users");
  return {};
}

const SET_ACTIVE = `
  mutation ($userId: ID!, $active: Boolean!) {
    setUserActive(userId: $userId, active: $active) { id }
  }`;

/** Bound in the page: `setActive.bind(null, user.id, !user.active)`. */
export async function setActive(userId: string, active: boolean) {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;
  await apiAsUser(SET_ACTIVE, { userId, active });
  revalidatePath("/admin/users");
}

/** What the edit and reset forms report back. */
export interface ManageUserState {
  error?: "forbidden" | "invalid" | "unavailable";
  messages?: string[];
  /** The change went through; the form shows a short confirmation. */
  done?: boolean;
}

const UPDATE_USER = `
  mutation ($input: UpdateUserInput!) {
    updateUser(input: $input) { id }
  }`;
const RESET_PASSWORD = `
  mutation ($input: ResetPasswordInput!) {
    resetUserPassword(input: $input) { id }
  }`;

/**
 * Runs one of the manage mutations and turns the API's errors into form
 * state. Shared by the edit and the reset-password actions.
 */
async function runManage(
  mutation: string,
  input: Record<string, unknown>,
): Promise<ManageUserState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "forbidden" };
  try {
    await apiAsUser(mutation, { input });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") return { error: "forbidden" };
      if (error.code === "BAD_REQUEST" || error.code === "BAD_USER_INPUT") {
        return {
          error: "invalid",
          messages:
            error.code === "BAD_REQUEST" && error.validationErrors.length > 0
              ? error.validationErrors
              : undefined,
        };
      }
    }
    console.error("Managing a user failed", error);
    return { error: "unavailable" };
  }
  revalidatePath("/admin/users");
  return { done: true };
}

/** Bound in the page: `updateUser.bind(null, user.id)`. */
export async function updateUser(
  userId: string,
  _previous: ManageUserState,
  formData: FormData,
): Promise<ManageUserState> {
  return runManage(UPDATE_USER, buildUpdateUserInput(userId, formData));
}

/** Bound in the page: `resetPassword.bind(null, user.id)`. */
export async function resetPassword(
  userId: string,
  _previous: ManageUserState,
  formData: FormData,
): Promise<ManageUserState> {
  return runManage(RESET_PASSWORD, buildResetPasswordInput(userId, formData));
}
