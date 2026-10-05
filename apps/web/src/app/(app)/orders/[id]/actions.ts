"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { apiAsUser, requireUser } from "@/lib/dal";

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
