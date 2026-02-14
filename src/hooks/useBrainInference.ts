/**
 * Phase 11: Filla Brain Inference
 * Fetches predictions from filla-brain-infer. Sends only anonymised vectors.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function bucketCondition(score: number): string {
  if (score < 30) return "0-30";
  if (score < 60) return "30-60";
  if (score < 80) return "60-80";
  return "80-100";
}

function bucketAge(years: number): string {
  if (years < 2) return "0-2";
  if (years < 5) return "2-5";
  if (years < 10) return "5-10";
  if (years < 15) return "10-15";
  return "15+";
}

export interface AssetVector {
  asset_type?: string;
  condition_score?: number;
  install_date?: string;
}

export interface ComplianceVector {
  document_type?: string;
}

export function useBrainInference(
  assets: AssetVector[],
  compliance: ComplianceVector[],
  enabled: boolean
) {
  const assetVectors = assets.map((a) => {
    const vec: Record<string, unknown> = {};
    if (a.asset_type) vec.asset_type = String(a.asset_type).toLowerCase().replace(/\s+/g, "_");
    if (a.condition_score != null) vec.condition_bucket = bucketCondition(a.condition_score);
    if (a.install_date) {
      const years = (Date.now() - new Date(a.install_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      vec.age_bucket = bucketAge(Math.floor(years));
    }
    return vec;
  }).filter((v) => Object.keys(v).length > 0);

  const complianceVectors = compliance
    .filter((c) => c.document_type)
    .map((c) => ({ document_type: (c.document_type || "").toLowerCase().replace(/\s+/g, "_") }));

  return useQuery({
    queryKey: ["brain-inference", JSON.stringify(assetVectors), JSON.stringify(complianceVectors)],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("filla-brain-infer", {
        body: { assets: assetVectors, compliance_documents: complianceVectors },
      });
      if (error) throw error;
      return data as { ok: boolean; predictions: { assets: any[]; compliance: any[] } };
    },
    enabled: enabled && (assetVectors.length > 0 || complianceVectors.length > 0),
  });
}
