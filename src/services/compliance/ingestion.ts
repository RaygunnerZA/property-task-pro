import { tryCatch } from '../../lib/async';
import { complianceSources } from './sources';
import { complianceJobs } from './jobs';
import { aiExtractor } from '../ai/extractor';
import { clauseInserter } from './clauseInserter';
import { IngestSourceInput } from '../../types/ingestion';

export const ingestionService = {
  async ingestSource(input: IngestSourceInput) {
    return tryCatch(async () => {
      // 1. Create source
      const { data: source } = await complianceSources.createSource({
        org_id: input.org_id,
        type: input.type,
        title: input.title,
        storage_path: input.storage_path
      });
      if (!source) throw new Error('Source creation failed.');

      // 2. Create job
      const { data: job } = await complianceJobs.createJob({
        org_id: input.org_id,
        source_id: source.id,
        type: 'extraction'
      });
      if (!job) throw new Error('Job creation failed.');

      // 3. Run extractor
      const { data: extracted } = await aiExtractor.extractFromSource({
        org_id: input.org_id,
        sourceText: input.sourceText ?? ''
      });
      if (!extracted) throw new Error('Extractor returned no clauses.');

      // 4. Insert clauses
      await clauseInserter.insertClauses({
        org_id: input.org_id,
        rule_id: null,
        version_id: null,
        clauses: extracted
      });

      // 5. Mark job success
      await complianceJobs.updateJobStatus(job.id, 'success');

      return {
        source_id: source.id,
        job_id: job.id,
        clauses: extracted
      };
    });
  }
};
