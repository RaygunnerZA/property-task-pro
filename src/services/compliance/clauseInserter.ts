import { supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';
import { ExtractedClause } from '../../types/ai';

interface ClauseInsertInput {
  org_id: string;
  rule_id: string | null;
  version_id: string | null;
  clauses: ExtractedClause[];
}

export const clauseInserter = {
  async insertClauses(input: ClauseInsertInput) {
    return tryCatch(async () => {
      const payload = input.clauses.map(c => ({
        org_id: input.org_id,
        rule_id: input.rule_id,
        version_id: input.version_id,
        text: c.text,
        category: c.category,
        confidence: c.confidence,
        flagged: c.confidence !== undefined && c.confidence < 0.7
      }));

      const { error } = await supabase
        .from('compliance_clauses')
        .insert(payload);

      if (error) throw error;
      return true;
    });
  }
};
