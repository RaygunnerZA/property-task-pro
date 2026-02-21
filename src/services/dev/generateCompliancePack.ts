/**
 * Generate Compliance Pack — Dev Seed Utility
 *
 * Creates a realistic set of compliance documents for a property,
 * distributed across valid / due-soon / expired / missing statuses.
 *
 * Safety:
 *   - Only callable in dev mode
 *   - Tags every row with `source: 'dev_seed'` metadata
 *   - Idempotent: skips compliance types already present on the property
 */

import { supabase } from "@/integrations/supabase/client";
import { COMPLIANCE_TEMPLATES } from "@/services/propertyIntelligence/complianceTemplates";
import { addDays, subDays, format } from "date-fns";

interface CompliancePackOptions {
  ratioValid?: number;
  ratioDueSoon?: number;
  ratioExpired?: number;
  ratioMissing?: number;
}

interface GenerateResult {
  inserted: number;
  skipped: number;
  details: Array<{ complianceType: string; status: string }>;
}

export async function generateCompliancePack(
  propertyId: string,
  orgId: string,
  options: CompliancePackOptions = {}
): Promise<GenerateResult> {
  if (!import.meta.env.DEV) {
    throw new Error("generateCompliancePack is only available in development mode");
  }

  const {
    ratioValid = 0.4,
    ratioDueSoon = 0.2,
    ratioExpired = 0.2,
    ratioMissing = 0.2,
  } = options;

  const { data: existing } = await supabase
    .from("compliance_documents")
    .select("document_type")
    .eq("property_id", propertyId);

  const existingTypes = new Set(existing?.map((d) => d.document_type) ?? []);
  const uniqueTemplates = COMPLIANCE_TEMPLATES.filter(
    (t, i, arr) =>
      arr.findIndex((x) => x.complianceType === t.complianceType) === i
  );
  const available = uniqueTemplates.filter(
    (t) => !existingTypes.has(t.complianceType)
  );

  if (available.length === 0) {
    return { inserted: 0, skipped: uniqueTemplates.length, details: [] };
  }

  const total = available.length;
  const validCount = Math.round(total * ratioValid);
  const dueSoonCount = Math.round(total * ratioDueSoon);
  const expiredCount = Math.round(total * ratioExpired);

  const shuffled = [...available].sort(() => Math.random() - 0.5);

  const now = new Date();
  const toInsert: Array<Record<string, unknown>> = [];
  const details: GenerateResult["details"] = [];
  let idx = 0;

  for (const template of shuffled) {
    let status: string;
    let expiryDate: string | null = null;
    let issueDate: string;

    if (idx < validCount) {
      status = "valid";
      issueDate = format(subDays(now, 60), "yyyy-MM-dd");
      expiryDate = format(addDays(now, 180 + Math.floor(Math.random() * 180)), "yyyy-MM-dd");
    } else if (idx < validCount + dueSoonCount) {
      status = "due_soon";
      issueDate = format(subDays(now, 300), "yyyy-MM-dd");
      expiryDate = format(addDays(now, Math.floor(Math.random() * 60)), "yyyy-MM-dd");
    } else if (idx < validCount + dueSoonCount + expiredCount) {
      status = "expired";
      issueDate = format(subDays(now, 400), "yyyy-MM-dd");
      expiryDate = format(subDays(now, Math.floor(Math.random() * 60) + 1), "yyyy-MM-dd");
    } else {
      status = "missing";
      details.push({ complianceType: template.complianceType, status: "missing" });
      idx++;
      continue;
    }

    toInsert.push({
      property_id: propertyId,
      org_id: orgId,
      document_type: template.complianceType,
      status,
      issue_date: issueDate,
      expiry_date: expiryDate,
      notes: `[dev_seed] Auto-generated compliance pack — ${status}`,
    });

    details.push({ complianceType: template.complianceType, status });
    idx++;
  }

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("compliance_documents")
      .insert(toInsert as any);

    if (error) {
      console.error("[generateCompliancePack] Insert error:", error);
      throw error;
    }
  }

  return {
    inserted: toInsert.length,
    skipped: existingTypes.size,
    details,
  };
}
