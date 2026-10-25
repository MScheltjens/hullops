import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { homePath } from "@/lib/user-roles";

// Everyone starts at the page their role works in.
export default async function Home() {
  const user = await requireUser();
  redirect(homePath(user.role));
}
