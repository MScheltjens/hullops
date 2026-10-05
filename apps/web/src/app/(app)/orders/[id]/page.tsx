import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiAsUser, requireUser } from "@/lib/dal";
import { StatusBadge, type Status } from "../status-badge";
import { CommentForm } from "./comment-form";

interface OrderDetail {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  serviceType: "CLEANING" | "PROTECTION";
  overdue: boolean;
  shipyard: string;
  berth: string | null;
  areaSqm: number | null;
  startDate: string;
  dueDate: string;
  vessel: { name: string; imoNumber: string | null };
  createdBy: { name: string };
  cleaningDetails: { method: string; surface: string } | null;
  protectionDetails: {
    kind: string;
    protectedItem: string | null;
    materials: string[];
    coatingProduct: string | null;
    layers: number | null;
    targetThicknessUm: number | null;
  } | null;
  team: { id: string; name: string }[];
  history: {
    status: Status;
    note: string | null;
    createdAt: string;
    author: { name: string };
  }[];
  comments: {
    id: string;
    text: string;
    source: string | null;
    createdAt: string;
    author: { name: string };
  }[];
}

const ORDER = `
  query ($id: ID!) {
    order(id: $id) {
      id title description status serviceType overdue shipyard berth areaSqm
      startDate dueDate
      vessel { name imoNumber }
      createdBy { name }
      cleaningDetails { method surface }
      protectionDetails {
        kind protectedItem materials coatingProduct layers targetThicknessUm
      }
      team { id name }
      history { status note createdAt author { name } }
      comments { id text source createdAt author { name } }
    }
  }`;

export async function generateMetadata({
  params,
}: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { order } = await apiAsUser<{ order: { title: string } | null }>(
    "query ($id: ID!) { order(id: $id) { title } }",
    { id },
  );
  return { title: order?.title };
}

export default async function OrderDetailPage({
  params,
}: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const { order } = await apiAsUser<{ order: OrderDetail | null }>(ORDER, {
    id,
  });
  // The API answers null for an unknown id.
  if (!order) notFound();

  const t = await getTranslations("orderDetail");
  const tOrders = await getTranslations("orders");
  const tForm = await getTranslations("orderForm");
  const format = await getFormatter();
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium" });
  const dateTime = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/orders"
          className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
        >
          ← {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {order.title}
          </h1>
          <StatusBadge status={order.status}>
            {tOrders(`status.${order.status}`)}
          </StatusBadge>
          {order.overdue && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
              {tOrders("overdue")}
            </span>
          )}
        </div>
        {order.description && (
          // whitespace-pre-line keeps the line breaks the lead typed.
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {order.description}
          </p>
        )}
      </div>

      <Section title={t("details")}>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Item label={tForm("vessel")}>
            {order.vessel.name}
            {order.vessel.imoNumber && ` (IMO ${order.vessel.imoNumber})`}
          </Item>
          <Item label={tForm("serviceType")}>
            {tOrders(`serviceType.${order.serviceType}`)}
          </Item>
          <Item label={tForm("shipyard")}>{order.shipyard}</Item>
          <Item label={tForm("berth")}>{order.berth}</Item>
          <Item label={tForm("startDate")}>{date(order.startDate)}</Item>
          <Item label={tForm("dueDate")}>{date(order.dueDate)}</Item>
          <Item label={tForm("areaSqm")}>{order.areaSqm}</Item>
          <Item label={t("createdBy")}>{order.createdBy.name}</Item>
          {order.cleaningDetails && (
            <>
              <Item label={tForm("method")}>{order.cleaningDetails.method}</Item>
              <Item label={tForm("surface")}>
                {order.cleaningDetails.surface}
              </Item>
            </>
          )}
          {order.protectionDetails && (
            <>
              <Item label={tForm("kind")}>
                {tForm(`kinds.${order.protectionDetails.kind}` as "kinds.COATING")}
              </Item>
              <Item label={tForm("protectedItem")}>
                {order.protectionDetails.protectedItem}
              </Item>
              <Item label={tForm("materials")}>
                {order.protectionDetails.materials
                  .map((m) =>
                    tForm(`materialNames.${m}` as "materialNames.OSB_STANDARD"),
                  )
                  .join(", ")}
              </Item>
              <Item label={tForm("coatingProduct")}>
                {order.protectionDetails.coatingProduct}
              </Item>
              <Item label={tForm("layers")}>{order.protectionDetails.layers}</Item>
              <Item label={tForm("targetThicknessUm")}>
                {order.protectionDetails.targetThicknessUm}
              </Item>
            </>
          )}
          <Item label={tOrders("columns.team")}>
            {order.team.map((member) => member.name).join(", ") || undefined}
          </Item>
        </dl>
      </Section>

      <Section title={t("comments")}>
        {order.comments.length === 0 ? (
          <p className="text-sm text-zinc-500 italic dark:text-zinc-400">
            {t("noComments")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {order.comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <p className="whitespace-pre-line">{comment.text}</p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {comment.author.name} · {dateTime(comment.createdAt)}
                  {comment.source && ` · ${t("from")} ${comment.source}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {/* Only project leads write comments; the API enforces it too. */}
        {user.role === "PROJECT_LEAD" && <CommentForm orderId={order.id} />}
      </Section>

      <Section title={t("history")}>
        <ol className="flex flex-col gap-2 text-sm">
          {order.history.map((entry, index) => (
            <li key={index} className="flex flex-wrap items-baseline gap-2">
              <StatusBadge status={entry.status}>
                {tOrders(`status.${entry.status}`)}
              </StatusBadge>
              <span className="text-zinc-500 dark:text-zinc-400">
                {entry.author.name} · {dateTime(entry.createdAt)}
              </span>
              {entry.note && <span className="w-full">{entry.note}</span>}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** A label with its value; renders nothing when the value is empty. */
function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  if (children === null || children === undefined || children === "") {
    return null;
  }
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
