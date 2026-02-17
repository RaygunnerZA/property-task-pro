/**
 * Shared task types. Use assigned_user_id as canonical field for assignee.
 */
export interface TaskWithAssignee {
  id: string;
  assigned_user_id: string | null;
  [key: string]: unknown;
}
