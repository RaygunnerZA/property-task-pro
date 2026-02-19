/**
 * usePropertyProfile
 *
 * Aggregates data from multiple existing tables into a single PropertyProfile
 * shape for the Property Intelligence Engine.
 *
 * Data sources (all existing tables, no schema changes needed):
 *   - property_details  → siteType, ownershipType, listingGrade
 *   - listed_buildings  → isListed (authoritative source)
 *   - property_legal    → leaseStart, leaseEnd, purchaseDate
 *   - assets            → presentAssetTypes (distinct asset_type values)
 *   - compliance_documents → presentComplianceTypes (distinct document_type values)
 *   - property_utilities → utilities
 *
 * Usage:
 *   const { profile, isLoading } = usePropertyProfile(propertyId);
 *
 * Consumers: ruleEvaluator, chipSuggestionEngine, usePropertyIntelligenceSeed,
 *            PropertyIntelligencePanel
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { PropertyProfile, SiteType, OwnershipType } from "@/services/propertyIntelligence/types";

export function usePropertyProfile(propertyId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["property_profile", orgId, propertyId],
    queryFn: async (): Promise<PropertyProfile | null> => {
      if (!propertyId || !orgId) return null;

      // Run all reads in parallel — these are independent queries
      const [detailsRes, listedRes, legalRes, assetsRes, complianceRes, utilitiesRes] =
        await Promise.all([
          supabase
            .from("property_details")
            .select("site_type, ownership_type, listing_grade")
            .eq("property_id", propertyId)
            .eq("org_id", orgId)
            .maybeSingle(),

          supabase
            .from("listed_buildings")
            .select("is_listed, listing_grade")
            .eq("property_id", propertyId)
            .eq("org_id", orgId)
            .maybeSingle(),

          supabase
            .from("property_legal")
            .select("lease_start, lease_end, purchase_date")
            .eq("property_id", propertyId)
            .eq("org_id", orgId)
            .maybeSingle(),

          supabase
            .from("assets")
            .select("asset_type")
            .eq("property_id", propertyId)
            .eq("org_id", orgId)
            .not("asset_type", "is", null),

          supabase
            .from("compliance_documents")
            .select("document_type")
            .eq("property_id", propertyId)
            .eq("org_id", orgId)
            .not("document_type", "is", null),

          supabase
            .from("property_utilities")
            .select("type, supplier")
            .eq("property_id", propertyId)
            .eq("org_id", orgId),
        ]);

      const details = detailsRes.data;
      const listed = listedRes.data;
      const legal = legalRes.data;
      const assets = assetsRes.data ?? [];
      const complianceDocs = complianceRes.data ?? [];
      const utilities = utilitiesRes.data ?? [];

      // Distinct asset types (non-null, deduplicated)
      const presentAssetTypes = [
        ...new Set(assets.map((a) => a.asset_type).filter(Boolean) as string[]),
      ];

      // Distinct compliance types (non-null, deduplicated)
      const presentComplianceTypes = [
        ...new Set(complianceDocs.map((d) => d.document_type).filter(Boolean) as string[]),
      ];

      return {
        propertyId,
        siteType: (details?.site_type as SiteType) ?? null,
        ownershipType: (details?.ownership_type as OwnershipType) ?? null,
        // listed_buildings is the authoritative source; fall back to listing_grade on property_details
        isListed: listed?.is_listed ?? false,
        listingGrade: listed?.listing_grade ?? details?.listing_grade ?? null,
        leaseStart: legal?.lease_start ?? null,
        leaseEnd: legal?.lease_end ?? null,
        purchaseDate: legal?.purchase_date ?? null,
        presentAssetTypes,
        presentComplianceTypes,
        utilities: utilities.map((u) => ({
          type: u.type,
          supplier: u.supplier ?? null,
          contractEnd: null, // Phase 2: add contract_end_date column to property_utilities
        })),
      };
    },
    enabled: !!propertyId && !!orgId && !orgLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes — profile data changes infrequently
    gcTime: 10 * 60 * 1000,
  });
}
