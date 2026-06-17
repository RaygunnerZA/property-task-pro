type TaskLike = {
  property_id?: string | null;
  title?: string | null;
  priority?: string | null;
  status?: string | null;
  due_date?: string | null;
  due_at?: string | null;
  created_at?: string | null;
};

type PropertyLike = {
  expired_compliance_count?: number | null;
};

function isOpenTask(task: TaskLike): boolean {
  const status = (task.status ?? "").toLowerCase();
  return status !== "completed" && status !== "archived" && status !== "done";
}

function isToday(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isDueWithinDays(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  return due >= now && due <= limit;
}

/** Max characters for the one-line AI / attention summary on property selector rows. */
export const PROPERTY_SELECTOR_HIGHLIGHT_MAX = 52;

export function truncatePropertySelectorHighlight(
  text: string,
  max = PROPERTY_SELECTOR_HIGHLIGHT_MAX
): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** One-line attention copy for property selector rows. */
export function getPropertySelectorHighlight(
  propertyId: string,
  tasks: TaskLike[],
  property?: PropertyLike
): string | null {
  const open = tasks.filter((t) => t.property_id === propertyId && isOpenTask(t));

  const urgent = open.filter((t) => {
    const p = (t.priority ?? "").toLowerCase();
    return p === "urgent" || p === "high";
  });

  const pick = urgent[0] ?? open[0];
  if (pick?.title) {
    const title = pick.title.trim();
    if (isToday(pick.created_at)) {
      return `${title} reported today.`;
    }
    const due = pick.due_date ?? pick.due_at;
    if (isDueWithinDays(due, 14)) {
      return `${title} due soon.`;
    }
    return title.endsWith(".") ? title : `${title}.`;
  }

  if ((property?.expired_compliance_count ?? 0) > 0) {
    return "Gas certificate expiring soon.";
  }

  return null;
}
