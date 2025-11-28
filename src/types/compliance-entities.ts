import { UUID, BaseEntity } from './shared';

export interface ComplianceSource extends BaseEntity {
  type: 'pdf' | 'image' | 'text';
  title: string;
  storage_path?: string;
}

export interface ComplianceClause extends BaseEntity {
  rule_id: UUID;
  text: string;
  category?: string;
  confidence?: number;
  flagged?: boolean;
}

export interface ComplianceReview extends BaseEntity {
  rule_id: UUID;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewer_id?: UUID;
}

export interface ComplianceSourceCreateInput {
  org_id: UUID;
  type: 'pdf' | 'image' | 'text';
  title: string;
  storage_path?: string;
}
