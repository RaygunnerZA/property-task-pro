import { ExtractedClause } from './ai';

export interface IngestSourceInput {
  org_id: string;
  type: 'text' | 'pdf' | 'image';
  title: string;
  sourceText?: string;
  storage_path?: string;
}

export interface IngestResult {
  source_id: string;
  job_id: string;
  clauses: ExtractedClause[];
}
