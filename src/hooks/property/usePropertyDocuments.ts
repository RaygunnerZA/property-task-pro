import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

export const DOCUMENT_CATEGORIES = [
  "Plans",
  "Legal",
  "Fire Safety",
  "Electrical",
  "Mechanical",
  "Water",
  "Insurance",
  "Contractors",
  "Warranties",
  "O&M Manuals",
  "Misc",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface DocMetadata {
  detected_spaces?: string[];
  detected_assets?: Array<{ serial_number?: string; model?: string; name?: string; confidence?: number }>;
  compliance_recommendations?: string[];
  hazards?: string[];
  analysed_at?: string;
  [key: string]: unknown;
}

export interface PropertyDocument {
  id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  title: string | null;
  category: string | null;
  document_type: string | null;
  expiry_date: string | null;
  renewal_frequency: string | null;
  status: string | null;
  notes: string | null;
  ocr_text?: string | null;
  metadata?: DocMetadata | null;
  ai_confidence?: number | null;
  created_at: string;
  updated_at: string;
  linked_spaces?: { id: string; name: string }[];
  linked_assets?: { id: string; name: string }[];
  linked_contractors?: { id: string; name: string }[];
  linked_compliance?: { id: string; title: string }[];
}

export interface UsePropertyDocumentsFilters {
  category?: string;
  search?: string;
  expiringSoon?: boolean;
  expired?: boolean;
  missing?: boolean;
  recentlyAdded?: boolean;
  hazards?: boolean; // filter by documents with hazards
  unlinked?: boolean; // filter by documents with no space/asset/compliance links
}

export interface UsePropertyDocumentsOptions {
  limit?: number;
  offset?: number;
}

export function usePropertyDocuments(
  propertyId: string,
  filters?: UsePropertyDocumentsFilters,
  options?: UsePropertyDocumentsOptions
) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data: documents = [], isLoading } = useQuery({
    queryKey: [
      "property-documents",
      propertyId,
      orgId,
      filters?.category,
      filters?.search,
      filters?.expiringSoon,
      filters?.expired,
      filters?.missing,
      filters?.recentlyAdded,
      filters?.hazards,
      filters?.unlinked,
      limit,
      offset,
    ],
    queryFn: async (): Promise<PropertyDocument[]> => {
      if (!orgId || !propertyId) return [];

      let query = supabase
        .from("attachments")
        .select(
          `
          id,
          file_url,
          file_name,
          file_type,
          file_size,
          thumbnail_url,
          title,
          category,
          document_type,
          expiry_date,
          renewal_frequency,
          status,
          notes,
          ocr_text,
          metadata,
          ai_confidence,
          created_at,
          updated_at
        `
        )
        .eq("org_id", orgId)
        .eq("parent_type", "property")
        .eq("parent_id", propertyId)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }

      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,file_name.ilike.%${filters.search}%,category.ilike.%${filters.search}%,ocr_text.ilike.%${filters.search}%`
        );
      }

      if (filters?.expiringSoon) {
        const now = new Date();
        const thirtyDays = new Date(now);
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        query = query
          .not("expiry_date", "is", null)
          .gte("expiry_date", now.toISOString().split("T")[0])
          .lte("expiry_date", thirtyDays.toISOString().split("T")[0]);
      }

      if (filters?.expired) {
        query = query
          .not("expiry_date", "is", null)
          .lt("expiry_date", new Date().toISOString().split("T")[0]);
      }

      if (filters?.missing) {
        query = query.is("file_url", null);
      }

      if (filters?.recentlyAdded) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte(
          "created_at",
          sevenDaysAgo.toISOString()
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      let docs = (data || []) as PropertyDocument[];

      if (filters?.hazards) {
        docs = docs.filter((d) => {
          const meta = d.metadata as DocMetadata | undefined;
          const hazards = meta?.hazards;
          return Array.isArray(hazards) && hazards.length > 0;
        });
      }

      if (filters?.unlinked) {
        const ids = docs.map((d) => d.id);
        if (ids.length === 0) return [];
        const [spRes, aRes, cRes] = await Promise.all([
          supabase.from("attachment_spaces").select("attachment_id").in("attachment_id", ids),
          supabase.from("attachment_assets").select("attachment_id").in("attachment_id", ids),
          supabase.from("attachment_compliance").select("attachment_id").in("attachment_id", ids),
        ]);
        const linkedIds = new Set([
          ...(spRes.data || []).map((r: { attachment_id: string }) => r.attachment_id),
          ...(aRes.data || []).map((r: { attachment_id: string }) => r.attachment_id),
          ...(cRes.data || []).map((r: { attachment_id: string }) => r.attachment_id),
        ]);
        docs = docs.filter((d) => !linkedIds.has(d.id));
      }

      return docs;
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
  });

  return { documents, isLoading };
}
