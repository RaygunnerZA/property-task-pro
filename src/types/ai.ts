export interface OpenAIExtractorInput {
  org_id: string;
  sourceText: string;
}

export interface ExtractedClause {
  id?: string;
  text: string;
  category?: string;
  confidence?: number;
}

export interface CriticResult {
  clause: ExtractedClause;
  flagged: boolean;
  notes: string | null;
  reasons: string[];
  suggested_category?: string;
  rewrite?: string;
}
