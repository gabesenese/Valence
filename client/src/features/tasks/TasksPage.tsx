import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, X, Plus, Building2, FileText, AlertTriangle, ChevronDown, Pencil, Calendar, User,
} from 'lucide-react';
import { tasksService, type Task, type TaskStatus, type CreateTaskInput } from '@/services/tasks.service';
import { usersService, type TeamMember } from '@/services/users.service';
import { useAuthStore } from '@/state/auth.store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; dot: string; badge: string }
> = {
  OPEN:        { label: 'Open',        dot: 'bg-slate-400', badge: 'bg-surface-400/60 text-slate-300 border-surface-500/60' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-info',      badge: 'bg-info/10 text-info border-info/20'                    },
  COMPLETED:   { label: 'Completed',   dot: 'bg-success',   badge: 'bg-success/10 text-success border-success/20'           },
  CANCELLED:   { label: 'Cancelled',   dot: 'bg-slate-600', badge: 'bg-surface-300/40 text-slate-500 border-surface-400/30' },
};

const ALL_STATUSES: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const STATUS_FILTER_OPTIONS = [
  { value: 'OPEN',        label: 'Open'        },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED',   label: 'Completed'   },
  { value: 'all',         label: 'All'         },
];

function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Inline status picker ──────────────────────────────────────────────────────
// Portaled to document.body so it escapes overflow-x-auto / overflow-hidden parents.

function StatusPicker({ status, onChange }: { status: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cfg = STATUS_CONFIG[status];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tracking-wide transition-all hover:brightness-110 ${cfg.badge}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 9999 }}
          className="w-36 overflow-hidden rounded-xl border border-surface-400/60 bg-surface-100 py-1 shadow-2xl shadow-black/60"
        >
          {ALL_STATUSES.map((s) => {
            const c = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-300 ${
                  s === status ? 'text-white' : 'text-slate-400'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
                {c.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Edit task modal ──────────────────────────────────────────────────────────

function EditTaskModal({
  task,
  onClose,
  onSubmit,
  users,
}: {
  task: Task;
  onClose: () => void;
  onSubmit: (data: { title: string; description?: string; assigneeUserId?: string | null; dueAt?: string | null }) => void;
  users: TeamMember[];
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [assigneeUserId, setAssigneeUserId] = useState(task.assignee?.id ?? '');
  const [dueAt, setDueAt] = useState(task.dueAt ? task.dueAt.slice(0, 10) : '');

  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...users
      .filter((u) => u.isActive)
      .map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
  ];

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeUserId: assigneeUserId || null,
      dueAt: dueAt || null,
    });
  };

  const context = task.lease
    ? { icon: FileText, label: task.lease.tenant.name }
    : task.property
    ? { icon: Building2, label: task.property.name }
    : task.alert
    ? { icon: AlertTriangle, label: task.alert.title }
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-surface-400/40 bg-surface-100 shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-400/20">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/20">
              <Pencil className="h-3.5 w-3.5 text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Edit Task</p>
              {context && (
                <div className="flex items-center gap-1 mt-0.5">
                  <context.icon className="h-3 w-3 text-slate-500" />
                  <span className="text-xs text-slate-500 truncate max-w-[220px]">{context.label}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-surface-300 hover:text-slate-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
              placeholder="Task title"
              className="rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, context, or instructions…"
              rows={3}
              className="rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30 resize-none transition-colors leading-relaxed"
            />
          </div>

          {/* Assignee + Due date side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <User className="h-3 w-3" />
                Assignee
              </label>
              <Select
                size="md"
                value={assigneeUserId}
                onChange={setAssigneeUserId}
                options={assigneeOptions}
                placeholder="Unassigned"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <Calendar className="h-3 w-3" />
                Due Date
              </label>
              <DatePicker
                value={dueAt}
                onChange={setDueAt}
                onClear={dueAt ? () => setDueAt('') : undefined}
                placeholder="No due date"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-surface-400/20 bg-surface-200/30">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!title.trim()} onClick={submit}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onStatusChange,
  onDelete,
  onEdit,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}) {
  const navigate = useNavigate();
  const isTemp = task.id.startsWith('temp-');
  const isOverdue =
    task.dueAt &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED' &&
    new Date(task.dueAt) < new Date();

  return (
    <tr className={`border-b border-surface-400/30 transition-colors group ${isTemp ? 'opacity-60' : 'hover:bg-surface-200/30'}`}>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={isTemp}
          onClick={() => !isTemp && onEdit(task)}
          className={`text-left w-full group/title ${isTemp ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <p
            className={`text-sm font-medium transition-colors ${
              task.status === 'COMPLETED' ? 'line-through text-slate-500' :
              task.status === 'CANCELLED' ? 'text-slate-600' :
              isTemp ? 'text-slate-200' : 'text-slate-200 group-hover/title:text-white'
            }`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
          )}
        </button>
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
            {isOverdue ? 'Overdue · ' : ''}{fmtDate(task.dueAt)}
          </span>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        {isTemp ? (
          <span className="text-xs text-slate-600 italic">Saving…</span>
        ) : (
          <StatusPicker status={task.status} onChange={(s) => onStatusChange(task.id, s)} />
        )}
      </td>

      <td className="px-4 py-3 text-xs text-slate-600">
        {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </td>

      <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isTemp && (
          <button
            onClick={() => onDelete(task.id)}
            className="text-slate-600 hover:text-danger transition-colors"
            title="Delete"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Create task modal ─────────────────────────────────────────────────────────
// Pure form — no mutation here. Parent handles the optimistic create.

function CreateTaskModal({
  onClose,
  onSubmit,
  users,
}: {
  onClose: () => void;
  onSubmit: (data: CreateTaskInput) => void;
  users: TeamMember[];
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...users
      .filter((u) => u.isActive)
      .map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
  ];

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeUserId: assigneeUserId || undefined,
      dueAt: dueAt || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl border border-surface-400/40 bg-surface-100 p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white mb-4">New Task</h2>
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
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
          <Select
            size="md"
            value={assigneeUserId}
            onChange={setAssigneeUserId}
            options={assigneeOptions}
            placeholder="Assign to..."
          />
          <DatePicker
            value={dueAt}
            onChange={setDueAt}
            onClear={dueAt ? () => setDueAt('') : undefined}
            placeholder="Due date (optional)"
          />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!title.trim()} onClick={submit}>
            Create Task
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksService.getAll(),
    staleTime: 30_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.listUsers,
    staleTime: 60_000,
  });

  const assigneeFilterOptions = useMemo(
    () => [
      { value: '',           label: 'All assignees'  },
      { value: 'me',         label: 'Assigned to me' },
      { value: 'unassigned', label: 'Unassigned'     },
      ...users
        .filter((u) => u.isActive)
        .map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
    ],
    [users],
  );

  const filtered = useMemo(
    () =>
      tasks
        .filter((t) => statusFilter === 'all' || t.status === statusFilter)
        .filter((t) => {
          if (!assigneeFilter) return true;
          if (assigneeFilter === 'me') return t.assignee?.id === me?.id;
          if (assigneeFilter === 'unassigned') return !t.assignee;
          return t.assignee?.id === assigneeFilter;
        }),
    [tasks, statusFilter, assigneeFilter, me?.id],
  );

  const openCount       = useMemo(() => tasks.filter((t) => t.status === 'OPEN').length, [tasks]);
  const inProgressCount = useMemo(() => tasks.filter((t) => t.status === 'IN_PROGRESS').length, [tasks]);
  const overdueCount    = useMemo(
    () => tasks.filter((t) => t.dueAt && t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && new Date(t.dueAt) < new Date()).length,
    [tasks],
  );

  // ── Optimistic create: close modal instantly, insert temp task ────────────
  const createMutation = useMutation({
    mutationFn: tasksService.create,
    onMutate: async (input) => {
      setShowCreate(false); // close immediately — no waiting for the server

      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']);

      const assigneeUser = users.find((u) => u.id === input.assigneeUserId);
      const tempId = `temp-${Date.now()}`;
      const tempTask: Task = {
        id: tempId,
        title: input.title,
        description: input.description ?? null,
        status: 'OPEN',
        alertId: null, leaseId: null, propertyId: null,
        completedAt: null, completionNote: null,
        dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : null,
        createdAt: new Date().toISOString(),
        assignee: assigneeUser
          ? { id: assigneeUser.id, firstName: assigneeUser.firstName, lastName: assigneeUser.lastName }
          : null,
        createdBy: null, completedBy: null,
        alert: null, lease: null, property: null,
      };

      qc.setQueryData<Task[]>(['tasks'], (old) => (old ? [tempTask, ...old] : [tempTask]));
      return { prev, tempId };
    },
    onSuccess: (realTask, _input, ctx) => {
      // Swap temp placeholder with the real task from the server
      qc.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) => (t.id === ctx?.tempId ? realTask : t)) ?? [],
      );
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // ── Optimistic status change ──────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksService.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']);
      qc.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t)) ?? [],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // ── Optimistic update ─────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof tasksService.update>[1] }) =>
      tasksService.update(id, data),
    onMutate: async ({ id, data }) => {
      setEditingTask(null);
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']);
      qc.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) => t.id === id ? {
          ...t,
          title: data.title ?? t.title,
          description: data.description !== undefined ? (data.description ?? null) : t.description,
          dueAt: data.dueAt !== undefined ? (data.dueAt ?? null) : t.dueAt,
          assignee: data.assigneeUserId === null
            ? null
            : data.assigneeUserId
              ? (t.assignee?.id === data.assigneeUserId ? t.assignee : t.assignee)
              : t.assignee,
        } : t) ?? [],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // ── Optimistic delete ─────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: tasksService.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']);
      qc.setQueryData<Task[]>(['tasks'], (old) => old?.filter((t) => t.id !== id) ?? []);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Tasks"
        description={`${openCount} open · ${inProgressCount} in progress${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-lg border border-surface-400/40 overflow-hidden">
          {STATUS_FILTER_OPTIONS.map((f) => (
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

        <Select
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          options={assigneeFilterOptions}
          className="w-44"
        />
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No tasks match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {['Task', 'Context', 'Assignee', 'Due', 'Status', 'Created', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onEdit={setEditingTask}
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
          onSubmit={(data) => createMutation.mutate(data)}
          users={users}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingTask.id, data })}
          users={users}
        />
      )}
    </div>
  );
}
