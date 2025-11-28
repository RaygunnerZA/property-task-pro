import { tryCatch } from '../../lib/async';
import { aiCritic } from '../ai/critic';
import { complianceClauses } from './clauses';
import { complianceReviews } from './reviews';
import { criticPrompt } from '../../lib/prompts/compliance';

export const criticPipeline = {
  async runCriticForSource(sourceId: string, orgId: string) {
    return tryCatch(async () => {
      // 1. Fetch clauses
      const { data: clauses } = await complianceClauses.getClausesBySource(sourceId);
      if (!clauses) throw new Error('No clauses found.');

      // 2. Call AI critic
      const { data: results } = await aiCritic.critique(clauses);
      if (!results) throw new Error('Critic returned no output.');

      // 3. Update clauses
      for (const item of results) {
        await complianceClauses.updateClauseCriticFields(item);
      }

      // 4. Create review record
      await complianceReviews.createPendingReview({
        org_id: orgId,
        source_id: sourceId,
        status: 'pending_review'
      });

      return results;
    });
  }
};
