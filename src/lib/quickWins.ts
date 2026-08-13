import { toast } from "sonner";

/** Quick-win setup steps on the onboarding Inflow feed. */

export const QUICK_WIN_IDS = ["profile", "asset", "upload", "task"] as const;
export type QuickWinId = (typeof QUICK_WIN_IDS)[number];

export const QUICK_WIN_COMPLETE_EVENT = "filla:quick-win-complete";
export const OPEN_PROPERTY_EDIT_EVENT = "filla:open-property-edit";

export const QUICK_WIN_DEMO_TASK_TITLE: Partial<Record<QuickWinId, string>> = {
  upload: "Upload One Document",
  task: "Create Your First Task",
};

const STORAGE_PREFIX = "filla:quick-wins:";

export type QuickWinCompleteDetail = {
  id: QuickWinId;
  propertyId: string;
  fresh: boolean;
};

function storageKey(propertyId: string) {
  return `${STORAGE_PREFIX}${propertyId}`;
}

export function quickWinIdFromAttentionId(attentionId: string): QuickWinId | null {
  const match = /^onboarding:quick:(profile|asset|upload|task)$/.exec(attentionId);
  return match ? (match[1] as QuickWinId) : null;
}

export function readCompletedQuickWins(propertyId: string): Set<QuickWinId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(propertyId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is QuickWinId => QUICK_WIN_IDS.includes(id as QuickWinId)));
  } catch {
    return new Set();
  }
}

export function writeCompletedQuickWins(propertyId: string, ids: Set<QuickWinId>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(propertyId), JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Persist a win. Returns true when this is the first time it was marked for this property. */
export function markQuickWinComplete(
  id: QuickWinId,
  propertyId: string | null | undefined
): boolean {
  if (!propertyId) return false;
  const prev = readCompletedQuickWins(propertyId);
  if (prev.has(id)) return false;
  const next = new Set(prev);
  next.add(id);
  writeCompletedQuickWins(propertyId, next);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<QuickWinCompleteDetail>(QUICK_WIN_COMPLETE_EVENT, {
          detail: { id, propertyId, fresh: true },
        })
      );
    } catch {
      /* node tests without CustomEvent */
    }
    try {
      const copy = quickWinCelebrationCopy(id);
      toast.success(copy.title, { description: copy.description });
      if (QUICK_WIN_IDS.every((win) => next.has(win))) {
        window.setTimeout(() => {
          toast.success(QUICK_WINS_ALL_DONE_COPY.title, {
            description: QUICK_WINS_ALL_DONE_COPY.description,
          });
        }, 420);
      }
    } catch {
      /* tests / no toaster */
    }
  }
  return true;
}

export function quickWinCelebrationCopy(id: QuickWinId): { title: string; description: string } {
  switch (id) {
    case "profile":
      return { title: "Profile saved", description: "That’s a Quick win." };
    case "asset":
      return { title: "Asset added", description: "That’s a Quick win." };
    case "upload":
      return { title: "Document filed", description: "That’s a Quick win." };
    case "task":
      return { title: "First task is in", description: "That’s a Quick win." };
  }
}

export const QUICK_WINS_ALL_DONE_COPY = {
  title: "You’re set up",
  description: "Filla has a profile, an asset, a document, and a task to learn from.",
} as const;
