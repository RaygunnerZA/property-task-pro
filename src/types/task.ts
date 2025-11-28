export type TaskStatus = 'pending' | 'in-progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  propertyId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date;
  assignedTo?: string;
  createdAt: Date;
}
