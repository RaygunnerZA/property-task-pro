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
}

export function usePropertyDocuments(
  propertyId: string,
  filters?: UsePropertyDocumentsFilters
) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

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
          created_at,
          updated_at
        `
        )
        .eq("org_id", orgId)
        .eq("parent_type", "property")
        .eq("parent_id", propertyId)
        .order("updated_at", { ascending: false });

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }

      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,file_name.ilike.%${filters.search}%,category.ilike.%${filters.search}%`
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
      return (data || []) as PropertyDocument[];
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
  });

  return { documents, isLoading };
}
