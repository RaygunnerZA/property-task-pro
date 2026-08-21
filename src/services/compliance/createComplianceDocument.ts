import { supabase } from "@/integrations/supabase/client";

export function complianceStatusFromExpiry(expiryDate: string | null | undefined): string {
  if (!expiryDate) return "valid";
  const exp = new Date(expiryDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  const days = Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

export async function createComplianceDocument(input: {
  orgId: string;
  propertyId?: string | null;
  title: string;
  documentType?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}): Promise<{ id: string }> {
  const documentType =
    input.documentType?.trim() && input.documentType.trim() !== "Other"
      ? input.documentType.trim()
      : null;
  const expiry = input.expiryDate?.trim() || null;
  const notes = input.notes?.trim() || null;

  const { data, error } = await supabase
    .from("compliance_documents")
    .insert({
      org_id: input.orgId,
      property_id: input.propertyId || null,
      title: input.title.trim(),
      document_type: documentType,
      expiry_date: expiry,
      next_due_date: expiry,
      notes,
      status: complianceStatusFromExpiry(expiry),
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("No compliance record returned");
  return data;
}
