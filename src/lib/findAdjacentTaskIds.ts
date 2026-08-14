type AdjacentRow = {
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdjacentIds = {
  prevId: string | null;
  nextId: string | null;
};

function createdMs(row: AdjacentRow): number {
  const raw = row.created_at || row.updated_at || 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Previous / next in an already-ordered list (workbench filter order).
 * Ends of the list return null.
 */
export function findAdjacentIdsInOrder(
  ids: Array<string | null | undefined>,
  currentId: string
): AdjacentIds {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  const index = ordered.indexOf(currentId);
  if (index < 0) return { prevId: null, nextId: null };
  return {
    prevId: ordered[index - 1] ?? null,
    nextId: ordered[index + 1] ?? null,
  };
}

/**
 * Previous / next task in newest-first order (same as the default workbench list).
 * `prev` is newer; `next` is older. Ends of the list return null.
 */
export function findAdjacentTaskIds(
  tasks: AdjacentRow[],
  currentTaskId: string
): AdjacentIds {
  const seen = new Set<string>();
  const ordered: AdjacentRow[] = [];
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
