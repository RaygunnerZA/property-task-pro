import { UUID, BaseEntity } from './shared';

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'completed';
}
