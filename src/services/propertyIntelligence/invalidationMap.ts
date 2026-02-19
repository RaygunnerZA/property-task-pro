/**
 * Property Intelligence — Event Invalidation Map
 *
 * The intelligence engine is pull-based: when any upstream data changes,
 * usePropertyProfile re-fetches and evaluateProfile runs again automatically.
 *
 * This file defines the dependency map: which mutations should invalidate
 * the property_profile cache for a given property.
 *
 * Usage pattern (call inside mutation onSuccess):
 *
 *   import { invalidatePropertyProfile } from "@/services/propertyIntelligence/invalidationMap";
 *
 *   // In a mutation that adds an asset:
 *   onSuccess: () => {
 *     invalidatePropertyProfile(queryClient, orgId, propertyId);
 *   }
 *
 * Why React Query cache invalidation rather than a custom event dispatcher:
 *   - React Query is already the event system for this stack.
 *   - Invalidating the profile cache causes all consumers (seed hook,
 *     intelligence panel, chip engine) to re-evaluate automatically.
 *   - No new infrastructure needed; no pub/sub, no observable streams.
 *   - Invalidation is lazy: re-fetch only happens when a component
 *     that reads the profile is mounted.
 *
 * Upstream tables that feed PropertyProfile → mutations that should call
 * invalidatePropertyProfile when they write to these tables:
 *
 *   Table                   Changed by
 *   ─────────────────────── ──────────────────────────────────────────
 *   property_details         updateDetails() in usePropertyDetails
 *   listed_buildings         Any listed building create/update mutation
 *   property_legal           updateLegal() in usePropertyLegal
 *   assets                   create/update/delete in asset mutations
 *   compliance_documents     create/update/delete in compliance mutations
 *   property_utilities       create/update/delete in usePropertyUtilities
 *
 * Phase 2 additions (when columns are added):
 *   property_legal.break_clause_dates → same invalidation
 *   property_utilities.contract_end_date → same invalidation
 *   assets.next_service_due → same invalidation
 */

import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidates the property profile cache for a given property.
 * Call this in mutation onSuccess handlers for any of the upstream tables listed above.
 */
export function invalidatePropertyProfile(
  queryClient: QueryClient,
  orgId: string,
  propertyId: string
): void {
  queryClient.invalidateQueries({
    queryKey: ["property_profile", orgId, propertyId],
  });
}

/**
 * Typed shape for intelligence events.
 * Used for documentation and future tracing/logging — not a dispatcher.
 *
 * When one of these events occurs, the corresponding mutation should call
 * invalidatePropertyProfile(). The evaluator runs automatically on next render.
 */
export type IntelligenceEvent =
  | { kind: "asset_added"; propertyId: string; assetType: string }
  | { kind: "asset_removed"; propertyId: string; assetType: string }
  | { kind: "lease_updated"; propertyId: string; changedFields: string[] }
  | { kind: "document_uploaded"; propertyId: string; documentType: string }
  | { kind: "property_details_updated"; propertyId: string; changedFields: string[] }
  | { kind: "listed_building_updated"; propertyId: string; isListed: boolean }
  | { kind: "utility_updated"; propertyId: string; utilityType: string };

/**
 * Log an intelligence event for future tracing/debugging.
 * Stub — extend with analytics or Supabase edge function call if needed.
 */
export function logIntelligenceEvent(event: IntelligenceEvent): void {
  if (process.env.NODE_ENV === "development") {
    console.debug("[Intelligence]", event.kind, event);
  }
}
