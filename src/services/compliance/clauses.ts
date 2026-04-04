import { supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';

export const complianceClauses = {
  async getById(clauseId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from("compliance_clauses")
        .select("*")
        .eq("id", clauseId)
        .single();
      if (error) throw error;
      return data;
    });
  },

  async listForReview(review: { org_id: string; rule_id: string | null }) {
    return tryCatch(async () => {
      let q = supabase
        .from("compliance_clauses")
        .select("*")
        .eq("org_id", review.org_id);

      if (review.rule_id) {
        q = q.eq("rule_id", review.rule_id);
      } else {
        q = q.eq("flagged", true).is("rule_id", null);
      }

      const { data, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    });
  },

  async updateClauseText(clauseId: string, text: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from("compliance_clauses")
        .update({ text })
        .eq("id", clauseId);
      if (error) throw error;
      return true;
    });
  },

  async getClausesBySource(sourceId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_clauses')
        .select('*')
        .eq('version_id', null)   // versioning later
        .eq('rule_id', null);     // rule linking later
      if (error) throw error;
      return data;
    });
  },

  async updateClauseCriticFields(result: any) {
    return tryCatch(async () => {
      const { clause, flagged, notes, reasons, suggested_category, rewrite } = result;

      const { error } = await supabase
        .from('compliance_clauses')
        .update({
          flagged,
          critic_notes: notes,
          category: suggested_category ?? clause.category
        })
        .eq('id', clause.id);

      if (error) throw error;
      return true;
    });
  },

  async bindClausesToVersion(ruleId: string, versionId: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('compliance_clauses')
        .update({ rule_id: ruleId, version_id: versionId })
        .eq('rule_id', null)
        .eq('version_id', null);
      if (error) throw error;
      return true;
    });
  }
};
