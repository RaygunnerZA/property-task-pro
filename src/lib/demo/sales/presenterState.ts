import { suggestionStateStorageKey } from "@/lib/signals/suggestionUserState";
import { SALES_HOME_SLUG, SALES_OPS_SLUG } from "@/lib/demo/sales/resetScope";

const SESSION_FLAG = "filla.salesDemoSuggestionsCleared.";

export function isSalesDemoSlug(slug: string | null | undefined): boolean {
  return slug === SALES_HOME_SLUG || slug === SALES_OPS_SLUG;
}

/** Removes recommendation dismissals and snoozes for one organisation only. */
export function clearSalesSuggestionState(orgId: string): void {
  if (!orgId || typeof localStorage === "undefined") return;
  localStorage.removeItem(suggestionStateStorageKey(orgId));
}

/**
 * First load of a sales-demo org in this browser tab restores recommendation cards.
 * Later dismissals in the same tab stay until the presenter clears them again.
 */
export function clearSalesSuggestionStateOnFirstView(orgId: string): boolean {
  if (!orgId || typeof sessionStorage === "undefined") return false;
  const flag = `${SESSION_FLAG}${orgId}`;
  if (sessionStorage.getItem(flag)) return false;
  clearSalesSuggestionState(orgId);
  sessionStorage.setItem(flag, "1");
  return true;
}
