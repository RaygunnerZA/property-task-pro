/**
 * Screen and section descriptions show once, then stay closed for the local day.
 * Stored in localStorage so a refresh in the same session does not bring them back.
 */

const STORAGE_KEY = "filla.contextual-descriptions";

type DismissStore = {
  day: string;
  ids: string[];
};

export function localDescriptionDay(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readStore(): DismissStore | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DismissStore>;
    if (typeof parsed.day !== "string" || !Array.isArray(parsed.ids)) return null;
    return {
      day: parsed.day,
      ids: parsed.ids.filter((id): id is string => typeof id === "string"),
    };
  } catch {
    return null;
  }
}

export function isDescriptionDismissed(id: string, now = new Date()): boolean {
  const store = readStore();
  if (!store || store.day !== localDescriptionDay(now)) return false;
  return store.ids.includes(id);
}

export function dismissDescription(id: string, now = new Date()): void {
  const bin = storage();
  if (!bin) return;
  const day = localDescriptionDay(now);
  const store = readStore();
  const ids = store && store.day === day ? [...store.ids] : [];
  if (!ids.includes(id)) ids.push(id);
  try {
    bin.setItem(STORAGE_KEY, JSON.stringify({ day, ids } satisfies DismissStore));
  } catch {
    /* private mode / quota — the description still closes for this view */
  }
}
