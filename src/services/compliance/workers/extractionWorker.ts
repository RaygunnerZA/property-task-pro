import { aiExtractor } from '../../ai/extractor';
import { complianceJobs } from '../jobs';
import { clauseInserter } from '../clauseInserter';

export async function runExtractionJob(job: any, source: any) {
  try {
    const { data: extracted } = await aiExtractor.extractFromSource({
      org_id: job.org_id,
      sourceText: source.sourceText ?? ''
    });

    if (!extracted) throw new Error('No clauses returned.');

    await clauseInserter.insertClauses({
      org_id: job.org_id,
      rule_id: null,
      version_id: null,
      clauses: extracted
    });

    await complianceJobs.updateJobStatus(job.id, 'success');
  } catch (err: any) {
    await complianceJobs.updateJobStatus(job.id, 'error');
  }
}
