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

      let query = supabase
        .from("attachments")
        .select(
          "id, file_url, file_name, file_type, file_size, thumbnail_url, title, category, document_type, expiry_date, renewal_frequency, status, notes, ocr_text, metadata, ai_confidence, created_at, updated_at, parent_type, parent_id"
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

      // Also include Add Record filings that were parented to compliance_documents
      // for this property (legacy path before property-level filing).
      let complianceAttachmentRows: Record<string, unknown>[] = [];
      const { data: complianceDocs } = await supabase
        .from("compliance_documents")
        .select("id")
        .eq("org_id", orgId)
        .eq("property_id", propertyId);
      const complianceIds = (complianceDocs || []).map((row) => row.id).filter(Boolean);
      if (complianceIds.length > 0) {
        let complianceQuery = supabase
          .from("attachments")
          .select(
            "id, file_url, file_name, file_type, file_size, thumbnail_url, title, category, document_type, expiry_date, renewal_frequency, status, notes, ocr_text, metadata, ai_confidence, created_at, updated_at, parent_type, parent_id"
          )
          .eq("org_id", orgId)
          .eq("parent_type", "compliance")
          .in("parent_id", complianceIds)
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (filters?.recentlyAdded) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          complianceQuery = complianceQuery.gte("created_at", sevenDaysAgo.toISOString());
        }
        const { data: complianceRaw, error: complianceErr } = await complianceQuery;
        if (complianceErr) throw complianceErr;
        complianceAttachmentRows = (complianceRaw || []) as Record<string, unknown>[];
      }

      const seenIds = new Set<string>();
      const mergedRows: Record<string, unknown>[] = [];
      for (const row of [...(rawData || []), ...complianceAttachmentRows]) {
        const id = String((row as { id?: string }).id || "");
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        mergedRows.push(row as Record<string, unknown>);
      }
      mergedRows.sort((a, b) => {
        const au = String(a.updated_at || "");
        const bu = String(b.updated_at || "");
        return bu.localeCompare(au);
      });

      // Map DB rows to PropertyDocument; prefer columns, fall back to metadata.
      const data = mergedRows.slice(0, limit).map((row: Record<string, unknown>) => {
        const meta = row.metadata as DocMetadata | undefined;
        return {
          ...row,
          title: (row.title as string) ?? (meta?.title as string) ?? null,
          category: (row.category as string) ?? (meta?.category as string) ?? null,
          document_type:
            (row.document_type as string) ?? (meta?.document_type as string) ?? null,
          expiry_date: (row.expiry_date as string) ?? (meta?.expiry_date as string) ?? null,
          renewal_frequency:
            (row.renewal_frequency as string) ??
            (meta?.renewal_frequency as string) ??
            null,
          status: (row.status as string) ?? (meta?.status as string) ?? null,
          notes: (row.notes as string) ?? (meta?.notes as string) ?? null,
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

      // Always enrich with space links (label model for Records filing).
      {
        const ids = docs.map((d) => d.id);
        if (ids.length > 0) {
          const { data: spaceRows } = await supabase
            .from("attachment_spaces")
            .select("attachment_id, space_id")
            .in("attachment_id", ids)
            .eq("org_id", orgId);

          const spaceIds = [
            ...new Set((spaceRows || []).map((r) => r.space_id).filter(Boolean)),
          ];
          const spaceNameById = new Map<string, string>();
          if (spaceIds.length > 0) {
            const { data: spacesData } = await supabase
              .from("spaces")
              .select("id, name")
              .in("id", spaceIds)
              .eq("org_id", orgId);
            for (const s of spacesData || []) {
              spaceNameById.set(s.id, (s.name ?? "").trim() || "Space");
            }
          }

          const spacesByAttachment = new Map<string, { id: string; name: string }[]>();
          for (const row of spaceRows || []) {
            const list = spacesByAttachment.get(row.attachment_id) ?? [];
            list.push({
              id: row.space_id,
              name: spaceNameById.get(row.space_id) ?? "Space",
            });
            spacesByAttachment.set(row.attachment_id, list);
          }

          docs = docs.map((d) => ({
            ...d,
            linked_spaces: spacesByAttachment.get(d.id) ?? [],
          }));
        } else {
          docs = docs.map((d) => ({ ...d, linked_spaces: [] }));
        }
      }

      if (filters?.unlinked) {
        const ids = docs.map((d) => d.id);
        if (ids.length === 0) return [];
        // attachment_assets / attachment_compliance may lag generated types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const [aRes, cRes] = await Promise.all([
          sb.from("attachment_assets").select("attachment_id").in("attachment_id", ids),
          sb.from("attachment_compliance").select("attachment_id").in("attachment_id", ids),
        ]);
        const linkedIds = new Set([
          ...docs.filter((d) => (d.linked_spaces?.length ?? 0) > 0).map((d) => d.id),
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
