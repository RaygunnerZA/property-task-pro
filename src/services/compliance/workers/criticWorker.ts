import { criticPipeline } from '../criticPipeline';

export async function runCriticJob(job: any) {
  return criticPipeline.runCriticForSource(job.source_id, job.org_id);
}
