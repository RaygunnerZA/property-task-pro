import { UUID, BaseEntity } from './shared';

export interface ComplianceRule extends BaseEntity {
  title: string;
  description: string;
  status: 'draft' | 'pending_review' | 'approved';
}
