import { text } from "./form-data";

/**
 * Turns the user-management forms into the inputs the API expects. A
 * plain function, like order-input.ts. The API checks every rule (valid
 * email, password length, unique email); nothing is repeated here.
 */

export const USER_ROLES = ["PROJECT_LEAD", "WORKER", "ADMIN"] as const;

export function buildCreateUserInput(formData: FormData) {
  return {
    name: text(formData, "name"),
    email: text(formData, "email"),
    // Not trimmed: spaces inside or around a password may be intended, and the
    // API hashes exactly what it gets.
    password: String(formData.get("password") ?? ""),
    role: text(formData, "role"),
    serviceTypes: formData.getAll("serviceTypes"),
  };
}

/**
 * The edit form. Your own row has no role field (you can't change your own
 * role), so `role` is then simply left out and the API keeps the current one.
 */
export function buildUpdateUserInput(userId: string, formData: FormData) {
  return {
    userId,
    name: text(formData, "name"),
    role: text(formData, "role"),
    serviceTypes: formData.getAll("serviceTypes"),
  };
}

/** The reset-password form. The password is sent exactly as typed. */
export function buildResetPasswordInput(userId: string, formData: FormData) {
  return { userId, password: String(formData.get("password") ?? "") };
}
