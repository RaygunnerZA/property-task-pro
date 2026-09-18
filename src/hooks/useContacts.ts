import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useAuth } from "@/hooks/useAuth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Contact = Tables<"contacts">;
export type ContactKind = "contact" | "contractor" | "supplier" | "agent" | "other";

export type ContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  role_label?: string | null;
  kind?: ContactKind;
  notes?: string | null;
  property_id?: string | null;
};

function contactsQueryKey(orgId: string | null | undefined, propertyId?: string | null) {
  return ["contacts", orgId ?? null, propertyId ?? "org"] as const;
}

/**
 * Org-scoped contacts directory. Optional propertyId filters to that property
 * plus org-wide (property_id IS NULL) contacts.
 */
export function useContacts(propertyId?: string | null) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: contactsQueryKey(orgId, propertyId),
    queryFn: async (): Promise<Contact[]> => {
      if (!orgId) return [];
      let q = supabase
        .from("contacts")
        .select("*")
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (propertyId) {
        q = q.or(`property_id.eq.${propertyId},property_id.is.null`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
    enabled: Boolean(orgId) && !orgLoading,
    staleTime: 30_000,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["contacts", orgId ?? null] });
  }, [queryClient, orgId]);

  const createMutation = useMutation({
    mutationFn: async (input: ContactInput) => {
      if (!orgId) throw new Error("No organisation");
      if (!user?.id) throw new Error("Not signed in");
      const name = input.name.trim();
      if (!name) throw new Error("Name is required");

      const row: TablesInsert<"contacts"> = {
        org_id: orgId,
        name,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        role_label: input.role_label?.trim() || null,
        kind: input.kind ?? "contact",
        notes: input.notes?.trim() || null,
        property_id: input.property_id ?? propertyId ?? null,
        created_by: user.id,
      };

      const { data, error } = await supabase.from("contacts").insert(row).select("*").single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: ContactInput & { id: string }) => {
      if (!orgId) throw new Error("No organisation");
      const name = input.name.trim();
      if (!name) throw new Error("Name is required");

      const patch: TablesUpdate<"contacts"> = {
        name,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        role_label: input.role_label?.trim() || null,
        kind: input.kind ?? "contact",
        notes: input.notes?.trim() || null,
        property_id: input.property_id === undefined ? undefined : input.property_id,
      };

      const { data, error } = await supabase
        .from("contacts")
        .update(patch)
        .eq("id", id)
        .eq("org_id", orgId)
        .select("*")
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error("No organisation");
      const { error } = await supabase.from("contacts").delete().eq("id", id).eq("org_id", orgId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const contacts = useMemo(() => query.data ?? [], [query.data]);

  return {
    contacts,
    isLoading: orgLoading || query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    createContact: createMutation.mutateAsync,
    updateContact: updateMutation.mutateAsync,
    deleteContact: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    refresh: invalidate,
  };
}
