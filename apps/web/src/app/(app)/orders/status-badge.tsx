import type { Status } from "@/lib/order-status";

export type { Status };

const STATUS_STYLES: Record<Status, string> = {
  PLANNED: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

/** The coloured label for an order's status, shared by the list and detail pages. */
export function StatusBadge({
  status,
  children,
}: {
  status: Status;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {children}
    </span>
  );
}
