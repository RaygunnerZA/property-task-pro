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
  enabled?: boolean;
}

export function usePropertyDocuments(
  propertyId?: string,
  filters?: UsePropertyDocumentsFilters,
  options?: UsePropertyDocumentsOptions
) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const queryEnabled = options?.enabled ?? true;

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

      // Select only columns that exist on attachments (per src/types/supabase.ts). Extended document
      // fields (title, category, document_type, expiry_date, etc.) are not in the schema and cause 400.
      let query = supabase
        .from("attachments")
        .select(
          "id, file_url, file_name, file_type, file_size, thumbnail_url, ocr_text, metadata, ai_confidence, created_at, updated_at"
        )
        .eq("org_id", orgId)
        .eq("parent_type", "property")
        .eq("parent_id", propertyId)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters?.missing) {
        query = query.is("file_url", null);
      }

      if (filters?.recentlyAdded) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte("created_at", sevenDaysAgo.toISOString());
      }

      const { data: rawData, error } = await query;
      if (error) throw error;

      // Map DB rows to PropertyDocument; extended fields come from metadata or null (columns not in DB).
      const data = (rawData || []).map((row: Record<string, unknown>) => {
        const meta = row.metadata as DocMetadata | undefined;
        return {
          ...row,
          title: (meta?.title as string) ?? row.title ?? null,
          category: (meta?.category as string) ?? row.category ?? null,
          document_type: (meta?.document_type as string) ?? row.document_type ?? null,
          expiry_date: (meta?.expiry_date as string) ?? row.expiry_date ?? null,
          renewal_frequency: (meta?.renewal_frequency as string) ?? row.renewal_frequency ?? null,
          status: (meta?.status as string) ?? row.status ?? null,
          notes: (meta?.notes as string) ?? row.notes ?? null,
        };
      }) as PropertyDocument[];

      let docs = data;

      // Client-side filters for fields not in DB (or when metadata is used)
      if (filters?.category) {
        docs = docs.filter((d) => d.category === filters.category);
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        docs = docs.filter(
          (d) =>
            (d.title?.toLowerCase().includes(s)) ||
            (d.file_name?.toLowerCase().includes(s)) ||
            (d.category?.toLowerCase().includes(s)) ||
            (d.ocr_text?.toLowerCase().includes(s))
        );
      }
      if (filters?.expiringSoon) {
        const now = new Date();
        const thirtyDays = new Date(now);
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        const nowStr = now.toISOString().split("T")[0];
        const thirtyStr = thirtyDays.toISOString().split("T")[0];
        docs = docs.filter(
          (d) =>
            d.expiry_date != null && d.expiry_date >= nowStr && d.expiry_date <= thirtyStr
        );
      }
      if (filters?.expired) {
        const today = new Date().toISOString().split("T")[0];
        docs = docs.filter((d) => d.expiry_date != null && d.expiry_date < today);
      }

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
    enabled: queryEnabled && !!orgId && !!propertyId && !orgLoading,
  });

  return { documents, isLoading };
}
