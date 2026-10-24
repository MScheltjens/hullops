import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { apiAsUser, requireUser } from "@/lib/dal";
import { setActive } from "./actions";
import { CreateUserForm } from "./create-user-form";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PROJECT_LEAD" | "WORKER";
  serviceTypes: ("CLEANING" | "PROTECTION")[];
  active: boolean;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function UsersPage() {
  const me = await requireUser();
  // Only administrators manage users. This just keeps others off a page that
  // would fail: the Server Actions and the API enforce the rule.
  if (me.role !== "ADMIN") redirect("/orders");

  const { users } = await apiAsUser<{ users: UserRow[] }>(
    "{ users(includeInactive: true) { id name email role serviceTypes active } }",
  );
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("addUser")}</h2>
        <CreateUserForm />
      </section>

      <ul className="flex flex-col gap-3">
        {users.map((user) => {
          const isMe = user.id === me.id;
          return (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className={user.active ? "" : "opacity-60"}>
                <div className="font-medium">
                  {user.name}
                  {isMe && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      ({t("you")})
                    </span>
                  )}
                  {!user.active && (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
                      {t("inactive")}
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {user.email}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {[
                    t(`roles.${user.role}`),
                    ...user.serviceTypes.map((s) => t(`serviceTypeNames.${s}`)),
                  ].join(" · ")}
                </div>
              </div>
              {/* You can't deactivate yourself; the API refuses it too. */}
              {!isMe && (
                <form action={setActive.bind(null, user.id, !user.active)}>
                  <button
                    type="submit"
                    className="min-h-11 rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    {user.active ? t("deactivate") : t("reactivate")}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
