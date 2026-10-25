import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { apiAsUser, requireUser } from "@/lib/dal";
import {
  canManageUsers,
  homePath,
  manageableRoles,
  type Role,
} from "@/lib/user-roles";
import { setActive } from "./actions";
import { CreateUserForm } from "./create-user-form";
import { EditUserForm, ResetPasswordForm } from "./manage-user";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  serviceTypes: ("CLEANING" | "PROTECTION")[];
  active: boolean;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function UsersPage() {
  const me = await requireUser();
  // Only administrators and HR manage users. This just keeps others off a
  // page that would fail: the Server Actions and the API enforce the rule.
  if (!canManageUsers(me.role)) redirect(homePath(me.role));
  const myRoles = manageableRoles(me.role);

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
        <CreateUserForm roles={myRoles} />
      </section>

      <ul className="flex flex-col gap-3">
        {users.map((user) => {
          const isMe = user.id === me.id;
          // HR sees admins and other HR, but can't change them (the API
          // refuses it too), so they get no buttons.
          const canManage = myRoles.includes(user.role);
          return (
            <li
              key={user.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                      ...user.serviceTypes.map((s) =>
                        t(`serviceTypeNames.${s}`),
                      ),
                    ].join(" · ")}
                  </div>
                </div>
                {/* You can't deactivate yourself; the API refuses it too. */}
                {!isMe && canManage && (
                  <form action={setActive.bind(null, user.id, !user.active)}>
                    <button
                      type="submit"
                      className="min-h-11 rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      {user.active ? t("deactivate") : t("reactivate")}
                    </button>
                  </form>
                )}
              </div>

              {/* Collapsed by default, so the list stays short on a phone. */}
              {canManage && (
              <details className="mt-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-sky-700 dark:text-sky-400">
                  {t("manage")}
                </summary>
                <div className="mt-2 flex max-w-xl flex-col gap-6">
                  {/*
                    The key makes the form start over with the saved values
                    after a change, since a mounted form keeps what was typed.
                  */}
                  <EditUserForm
                    key={`${user.name}|${user.role}|${user.serviceTypes.join()}`}
                    userId={user.id}
                    name={user.name}
                    role={user.role}
                    serviceTypes={user.serviceTypes}
                    isMe={isMe}
                    roles={myRoles}
                  />
                  <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold">
                      {t("resetPassword")}
                    </h3>
                    <ResetPasswordForm userId={user.id} />
                  </div>
                </div>
              </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
