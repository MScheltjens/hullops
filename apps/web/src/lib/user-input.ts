import { text } from "./form-data";

/**
 * Turns the "add a user" form into the `CreateUserInput` the API expects. A
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
