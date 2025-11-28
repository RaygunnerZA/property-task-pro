export interface OpenAIExtractorInput {
  org_id: string;
  sourceText: string;
}

export interface ExtractedClause {
  text: string;
  category?: string;
  confidence?: number;
}

export interface CriticResult {
  clause: ExtractedClause;
  flagged: boolean;
  notes: string | null;
}
