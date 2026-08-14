type AdjacentTaskRow = {
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdjacentTaskIds = {
  prevId: string | null;
  nextId: string | null;
};

function createdMs(row: AdjacentTaskRow): number {
  const raw = row.created_at || row.updated_at || 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Previous / next task in newest-first order (same as the default workbench list).
 * `prev` is newer; `next` is older. Ends of the list return null.
 */
export function findAdjacentTaskIds(
  tasks: AdjacentTaskRow[],
  currentTaskId: string
): AdjacentTaskIds {
  const seen = new Set<string>();
  const ordered: AdjacentTaskRow[] = [];
  for (const row of tasks) {
    const id = row?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(row);
  }

  ordered.sort((a, b) => createdMs(b) - createdMs(a));
  const index = ordered.findIndex((row) => row.id === currentTaskId);
  if (index < 0) return { prevId: null, nextId: null };

  return {
    prevId: ordered[index - 1]?.id ?? null,
    nextId: ordered[index + 1]?.id ?? null,
  };
}
