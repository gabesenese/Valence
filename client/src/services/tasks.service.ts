import { api, extractData } from './api';

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TaskUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  alertId: string | null;
  leaseId: string | null;
  propertyId: string | null;
  completedAt: string | null;
  completionNote: string | null;
  dueAt: string | null;
  createdAt: string;
  assignee:    TaskUser | null;
  createdBy:   TaskUser | null;
  completedBy: TaskUser | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  alertId?: string;
  leaseId?: string;
  propertyId?: string;
  assigneeUserId?: string;
  dueAt?: string;
}

export const tasksService = {
  getForItem: (filter: { alertId?: string; leaseId?: string; propertyId?: string }): Promise<Task[]> =>
    api.get('/tasks', { params: filter }).then(extractData<Task[]>),

  create: (data: CreateTaskInput): Promise<Task> =>
    api.post('/tasks', data).then(extractData<Task>),

  updateStatus: (id: string, status: TaskStatus, completionNote?: string): Promise<Task> =>
    api.patch(`/tasks/${id}/status`, { status, completionNote }).then(extractData<Task>),

  delete: (id: string): Promise<void> =>
    api.delete(`/tasks/${id}`).then(() => undefined),
};
