import type { QueryClient } from "@tanstack/react-query";

const OPENISH = new Set(["open", "in_progress", "waiting_review"]);

type TaskRow = {
  id?: string | null;
  status?: string | null;
  property_id?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

/**
 * Pick the next actionable task after completing `currentTaskId`.
 * Prefers same property, then earliest due / newest created.
 */
export function findNextOpenTaskId(
  queryClient: QueryClient,
  currentTaskId: string,
  propertyId?: string | null
): string | null {
  const caches = queryClient.getQueriesData<unknown>({ queryKey: ["tasks"] });
  const seen = new Set<string>();
  const candidates: TaskRow[] = [];

  for (const [, data] of caches) {
    if (!Array.isArray(data)) continue;
    for (const row of data as TaskRow[]) {
      const id = row?.id;
      if (!id || id === currentTaskId || seen.has(id)) continue;
      const status = String(row.status ?? "").toLowerCase();
      if (!OPENISH.has(status)) continue;
      seen.add(id);
      candidates.push(row);
    }
  }

  if (candidates.length === 0) return null;

  const sameProperty = propertyId
    ? candidates.filter((t) => t.property_id === propertyId)
    : [];
  const pool = sameProperty.length > 0 ? sameProperty : candidates;

  pool.sort((a, b) => {
    const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bc - ac;
  });

  return pool[0]?.id ?? null;
}
