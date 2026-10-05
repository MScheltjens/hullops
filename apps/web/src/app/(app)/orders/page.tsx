import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { apiAsUser, requireUser } from "@/lib/dal";
import { StatusBadge, type Status } from "./status-badge";

const STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const satisfies readonly Status[];
const SERVICE_TYPES = ["CLEANING", "PROTECTION"] as const;
type ServiceType = (typeof SERVICE_TYPES)[number];

interface OrderRow {
  id: string;
  title: string;
  status: Status;
  serviceType: ServiceType;
  overdue: boolean;
  dueDate: string;
  shipyard: string;
  berth: string | null;
  vessel: { name: string };
  commentCount: number;
  team: { id: string; name: string }[];
}

const ORDERS = `
  query ($status: OrderStatus, $serviceType: ServiceType, $overdue: Boolean) {
    orders(status: $status, serviceType: $serviceType, overdue: $overdue, take: 100) {
      id title status serviceType overdue dueDate shipyard berth
      vessel { name }
      commentCount
      team { id name }
    }
  }`;

/** Keeps a search param only if it's one of the allowed values. */
function pick<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

export default async function OrdersPage({
  searchParams,
}: PageProps<"/orders">) {
  // Filters live in the URL (?status=PLANNED&overdue=true), so a filtered
  // view can be bookmarked or shared, and the page needs no client state.
  const user = await requireUser();
  const params = await searchParams;
  const status = pick(params.status, STATUSES);
  const serviceType = pick(params.serviceType, SERVICE_TYPES);
  const overdue = pick(params.overdue, ["true", "false"] as const);

  const { orders } = await apiAsUser<{ orders: OrderRow[] }>(ORDERS, {
    status,
    serviceType,
    overdue: overdue === undefined ? undefined : overdue === "true",
  });

  const t = await getTranslations("orders");
  const format = await getFormatter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        {/* Hidden for workers; the API and the form page enforce the rule. */}
        {user.role === "PROJECT_LEAD" && (
          <Link
            href="/orders/new"
            className="flex min-h-11 items-center rounded-md bg-sky-700 px-4 text-sm font-medium text-white hover:bg-sky-800"
          >
            {t("newOrder")}
          </Link>
        )}
      </div>

      {/* A plain GET form: submitting it just changes the URL's filters. */}
      <form className="grid grid-cols-2 items-end gap-3 text-sm sm:flex sm:flex-wrap">
        <Filter label={t("filters.status")} name="status" value={status}>
          <option value="">{t("filters.all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Filter>
        <Filter
          label={t("filters.serviceType")}
          name="serviceType"
          value={serviceType}
        >
          <option value="">{t("filters.all")}</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`serviceType.${s}`)}
            </option>
          ))}
        </Filter>
        <Filter label={t("filters.overdue")} name="overdue" value={overdue}>
          <option value="">{t("filters.all")}</option>
          <option value="true">{t("filters.onlyOverdue")}</option>
          <option value="false">{t("filters.onlyOnTime")}</option>
        </Filter>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-sky-700 px-4 font-medium text-white hover:bg-sky-800"
        >
          {t("filters.apply")}
        </button>
        <Link
          href="/orders"
          className="flex min-h-11 items-center justify-center px-1 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
        >
          {t("filters.reset")}
        </Link>
      </form>

      {orders.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {t("empty")}
        </p>
      ) : (
        <>
          {/*
            On a phone a table would need sideways scrolling, so each order is
            a card, and the whole card is one big tap target. From md up the
            table gives a better overview.
          */}
          <ul className="flex flex-col gap-3 md:hidden">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 active:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:active:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{order.title}</span>
                    <StatusBadge status={order.status}>
                      {t(`status.${order.status}`)}
                    </StatusBadge>
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {[order.vessel.name, order.shipyard, order.berth]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span>{t(`serviceType.${order.serviceType}`)}</span>
                    <span className="whitespace-nowrap">
                      {t("columns.due")}{" "}
                      {format.dateTime(new Date(order.dueDate), {
                        dateStyle: "medium",
                      })}
                    </span>
                    {order.overdue && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                        {t("overdue")}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">
                    {order.team.length > 0 ? (
                      order.team.map((member) => member.name).join(", ")
                    ) : (
                      <span className="text-zinc-400 italic">{t("noTeam")}</span>
                    )}
                  </div>
                  {order.commentCount > 0 && (
                    <div className="text-xs text-sky-700 dark:text-sky-400">
                      {t("comments", { count: order.commentCount })}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 md:block dark:border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("columns.order")}</th>
                  <th className="px-4 py-3 font-medium">{t("columns.vessel")}</th>
                  <th className="px-4 py-3 font-medium">{t("columns.service")}</th>
                  <th className="px-4 py-3 font-medium">{t("columns.status")}</th>
                  <th className="px-4 py-3 font-medium">{t("columns.due")}</th>
                  <th className="px-4 py-3 font-medium">{t("columns.team")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {orders.map((order) => (
                  <tr key={order.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium hover:underline"
                      >
                        {order.title}
                      </Link>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {[order.shipyard, order.berth].filter(Boolean).join(" · ")}
                      </div>
                      {order.commentCount > 0 && (
                        <div className="text-xs text-sky-700 dark:text-sky-400">
                          {t("comments", { count: order.commentCount })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{order.vessel.name}</td>
                    <td className="px-4 py-3">
                      {t(`serviceType.${order.serviceType}`)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status}>
                        {t(`status.${order.status}`)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format.dateTime(new Date(order.dueDate), {
                        dateStyle: "medium",
                      })}
                      {order.overdue && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                          {t("overdue")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {order.team.length > 0 ? (
                        order.team.map((member) => member.name).join(", ")
                      ) : (
                        <span className="text-zinc-400 italic">{t("noTeam")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Filter({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 font-medium">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="min-h-11 rounded-md border border-zinc-300 bg-white px-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
      >
        {children}
      </select>
    </label>
  );
}
