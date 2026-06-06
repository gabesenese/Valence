import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, CheckCircle2, Circle, Clock, X, Plus, Filter,
  Building2, FileText, AlertTriangle,
} from 'lucide-react';
import { tasksService, type Task, type TaskStatus } from '@/services/tasks.service';
import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/state/auth.store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  OPEN:        { label: 'Open',        icon: Circle,       color: 'text-slate-400' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock,        color: 'text-warning'   },
  COMPLETED:   { label: 'Completed',   icon: CheckCircle2, color: 'text-success'   },
  CANCELLED:   { label: 'Cancelled',   icon: X,            color: 'text-slate-600' },
};

const NEXT: Partial<Record<TaskStatus, TaskStatus>> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

function formatDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onStatusChange, onDelete }: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const cfg = STATUS_CONFIG[task.status];
  const Icon = cfg.icon;
  const next = NEXT[task.status];
  const isOverdue = task.dueAt && task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
    && new Date(task.dueAt) < new Date();

  return (
    <tr className="border-b border-surface-400/30 hover:bg-surface-200/30 transition-colors group">
      <td className="px-4 py-3 w-8">
        <button
          onClick={() => next && onStatusChange(task.id, next)}
          disabled={!next}
          className={`transition-colors ${cfg.color} ${next ? 'hover:opacity-70' : 'cursor-default opacity-50'}`}
          title={next ? `Mark as ${STATUS_CONFIG[next].label}` : cfg.label}
        >
          <Icon className="h-4 w-4" />
        </button>
      </td>
      <td className="px-4 py-3">
        <p className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {task.lease && (
            <button
              onClick={() => navigate(`/leases/${task.lease!.id}`)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-300 transition-colors"
            >
              <FileText className="h-3 w-3 text-slate-600 shrink-0" />
              {task.lease.tenant.name}
            </button>
          )}
          {task.property && (
            <button
              onClick={() => navigate(`/properties/${task.property!.id}`)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Building2 className="h-3 w-3 text-slate-600 shrink-0" />
              {task.property.name}
            </button>
          )}
          {task.alert && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <AlertTriangle className="h-3 w-3 text-slate-600 shrink-0" />
              {task.alert.title.slice(0, 30)}
            </div>
          )}
          {!task.lease && !task.property && !task.alert && (
            <span className="text-xs text-slate-600">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {task.assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-[10px] font-bold text-brand-400">
              {task.assignee.firstName[0]}{task.assignee.lastName[0]}
            </div>
            <span className="text-xs text-slate-400">{task.assignee.firstName}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-600">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3">
        {task.dueAt ? (
          <span className={`text-xs font-medium ${isOverdue ? 'text-danger' : 'text-slate-400'}`}>
            {isOverdue ? 'Overdue · ' : ''}{formatDate(task.dueAt)}
          </span>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant={
          task.status === 'COMPLETED' ? 'success' :
          task.status === 'IN_PROGRESS' ? 'info' :
          task.status === 'CANCELLED' ? 'neutral' : 'neutral'
        }>
          {STATUS_CONFIG[task.status].label}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </td>
      <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onDelete(task.id)}
          className="text-slate-600 hover:text-danger transition-colors"
          title="Delete task"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── Create task modal ────────────────────────────────────────────────────────

function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersService.listUsers });

  const mutation = useMutation({
    mutationFn: () => tasksService.create({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeUserId: assigneeUserId || undefined,
      dueAt: dueAt || undefined,
    }),
    onSuccess: () => { onCreated(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-surface-400/40 bg-surface-100 p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white mb-4">New Task</h2>
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 resize-none"
          />
          <select
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
            className="rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
          >
            <option value="">Unassigned</option>
            {users.filter((u) => u.isActive).map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
          />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!title.trim()}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Create Task
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'Open',        value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed',   value: 'COMPLETED' },
  { label: 'All',         value: 'all' },
];

export default function TasksPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersService.listUsers });

  const queryParams = {
    ...(statusFilter !== 'all' ? { status: statusFilter as TaskStatus } : {}),
    ...(assigneeFilter === 'me' ? { assigneeUserId: me?.id } :
        assigneeFilter === 'unassigned' ? { unassigned: true } :
        assigneeFilter ? { assigneeUserId: assigneeFilter } : {}),
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'all', queryParams],
    queryFn: () => tasksService.getAll(queryParams),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksService.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: tasksService.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const openCount = tasks.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const overdueCount = tasks.filter(
    (t) => t.dueAt && t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && new Date(t.dueAt) < new Date()
  ).length;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {openCount} open · {inProgressCount} in progress{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status */}
        <div className="flex rounded-lg border border-surface-400/40 overflow-hidden">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-brand-600/20 text-brand-300'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-200/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Assignee */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded-md border border-surface-400/40 bg-surface-200 px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
          >
            <option value="">All assignees</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {users.filter((u) => u.isActive).map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <PageLoader />
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">No tasks match these filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  <th className="px-4 py-3 w-8" />
                  {['Task', 'Context', 'Assignee', 'Due', 'Status', 'Created', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['tasks'] })}
        />
      )}
    </div>
  );
}
