/**
 * Screen and section descriptions show once, then stay closed for the local day.
 * Stored in localStorage so a refresh in the same session does not bring them back.
 */

const STORAGE_KEY = "filla.contextual-descriptions";
/** Page-title heroes (illustration + H1 + description) minimise once per local day. */
const PAGE_TITLE_KEY = "filla.page-title-minimise";

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

function readStore(key: string): DismissStore | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
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

function remember(key: string, id: string, now: Date): void {
  const bin = storage();
  if (!bin) return;
  const day = localDescriptionDay(now);
  const store = readStore(key);
  const ids = store && store.day === day ? [...store.ids] : [];
  if (!ids.includes(id)) ids.push(id);
  try {
    bin.setItem(key, JSON.stringify({ day, ids } satisfies DismissStore));
  } catch {
    /* private mode / quota — the view still closes for this mount */
  }
}

function remembered(key: string, id: string, now: Date): boolean {
  const store = readStore(key);
  if (!store || store.day !== localDescriptionDay(now)) return false;
  return store.ids.includes(id);
}

export function isDescriptionDismissed(id: string, now = new Date()): boolean {
  return remembered(STORAGE_KEY, id, now);
}

export function dismissDescription(id: string, now = new Date()): void {
  remember(STORAGE_KEY, id, now);
}

export function isPageTitleMinimised(id: string, now = new Date()): boolean {
  return remembered(PAGE_TITLE_KEY, id, now);
}

export function minimisePageTitle(id: string, now = new Date()): void {
  remember(PAGE_TITLE_KEY, id, now);
}
