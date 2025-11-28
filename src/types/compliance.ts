import { UUID, BaseEntity } from './shared';

export interface ComplianceRule extends BaseEntity {
  title: string;
  description: string;
  source_id?: UUID;
  status: 'draft' | 'pending_review' | 'approved';
}

export interface ComplianceRuleVersion extends BaseEntity {
  rule_id: UUID;
  version_number: number;
  approved_at?: string;
  approved_by?: UUID;
}

export interface ComplianceClause extends BaseEntity {
  rule_id?: UUID;
  version_id?: UUID;
  text: string;
  category?: string;
  confidence?: number;
  flagged?: boolean;
  critic_notes?: string;
}
