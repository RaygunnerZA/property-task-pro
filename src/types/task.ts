/**
 * Shared task types. Use assigned_user_id as canonical field for assignee.
 */
export interface TaskWithAssignee {
  id: string;
  assigned_user_id: string | null;
  [key: string]: unknown;
}

// Legacy mock types used by WorkTasks.tsx / mockData.ts (not DB-backed)
export type TaskStatus = "pending" | "in-progress" | "completed";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  propertyId: string;
  dueDate?: string;
  assignedTo?: string;
  priority?: "low" | "medium" | "high";
  [key: string]: unknown;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  [key: string]: unknown;
}
