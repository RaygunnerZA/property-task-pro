/**
 * Property filter state machine (pure, no side effects).
 * Active set is never empty: ALL is represented as active.size === allProperties.length.
 *
 * Transition table (N=4 properties A,B,C,D):
 *   ALL        → click A → [A]           (SINGLE)
 *   [A]        → click A → ALL
 *   [A]        → click B → [A,B]         (MULTI)
 *   [A,B]      → click C → [A,B,C]
 *   [A,B,C]    → click B → [A,C]
 *   [A,C]      → click A → [C]          (remove A → SINGLE)
 *   [C]        → click C → ALL
 */

/**
 * Returns whether the active set represents "all properties" (no filter).
 */
export function isAllPropertiesActive(
  activeSet: Set<string>,
  allProperties: string[]
): boolean {
  return allProperties.length > 0 && activeSet.size === allProperties.length;
}

/** True when the workbench focuses a strict subset of properties (not ALL). */
export function isPropertySubsetSelected(
  selectedPropertyIds: Set<string> | undefined,
  allPropertyIds: string[]
): boolean {
  if (!selectedPropertyIds || allPropertyIds.length === 0) return false;
  if (selectedPropertyIds.size === 0) return false;
  return !isAllPropertiesActive(selectedPropertyIds, allPropertyIds);
}

/** Property ids in scope for lists/counts — all ids when no subset filter is active. */
export function scopedPropertyIdSet(
  selectedPropertyIds: Set<string> | undefined,
  allPropertyIds: string[]
): Set<string> {
  if (allPropertyIds.length === 0) return new Set();
  if (
    !selectedPropertyIds ||
    selectedPropertyIds.size === 0 ||
    isAllPropertiesActive(selectedPropertyIds, allPropertyIds)
  ) {
    return new Set(allPropertyIds);
  }
  return new Set(
    [...selectedPropertyIds].filter((id) => allPropertyIds.includes(id))
  );
}

export function recordMatchesPropertyScope(
  propertyId: string | null | undefined,
  selectedPropertyIds: Set<string> | undefined,
  allPropertyIds: string[]
): boolean {
  if (!isPropertySubsetSelected(selectedPropertyIds, allPropertyIds)) return true;
  if (!propertyId) return false;
  return scopedPropertyIdSet(selectedPropertyIds, allPropertyIds).has(propertyId);
}

export function taskMatchesPropertyScope(
  task: { property_id?: string | null },
  selectedPropertyIds: Set<string> | undefined,
  allPropertyIds: string[]
): boolean {
  if (!isPropertySubsetSelected(selectedPropertyIds, allPropertyIds)) return true;
  return (
    task.property_id != null &&
    scopedPropertyIdSet(selectedPropertyIds, allPropertyIds).has(task.property_id)
  );
}

/**
 * Pure helper: given current active set and a clicked property id, returns the new active set.
 * Invariants: returned set is never empty; if removal would empty the set, returns ALL_PROPERTIES.
 *
 * Rules:
 * 1) ALL → click P → [P] (SINGLE)
 * 2) SINGLE, click sole active → ALL
 * 3) SINGLE, click inactive → [existing, clicked] (MULTI)
 * 4) MULTI, click active → remove; if empty → ALL, else MULTI or SINGLE
 * 5) MULTI, click inactive → add (MULTI)
 */
export function togglePropertyFilter(
  clickedPropertyId: string,
  activeSet: Set<string>,
  allProperties: string[]
): Set<string> {
  if (allProperties.length === 0) return activeSet;

  const isAll = activeSet.size === allProperties.length;
  const isClickedActive = activeSet.has(clickedPropertyId);

  // ALL → click any → [clicked] (SINGLE)
  if (isAll) {
    return new Set([clickedPropertyId]);
  }

  // SINGLE: only one active
  if (activeSet.size === 1) {
    if (isClickedActive) {
      // Click sole active → ALL
      return new Set(allProperties);
    }
    // Click inactive → add (MULTI)
    return new Set([...activeSet, clickedPropertyId]);
  }

  // MULTI: more than one active
  if (isClickedActive) {
    const next = new Set(activeSet);
    next.delete(clickedPropertyId);
    if (next.size === 0) return new Set(allProperties);
    return next;
  }

  // MULTI, click inactive → add
  return new Set([...activeSet, clickedPropertyId]);
}
