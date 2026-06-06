import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock, Plus, Loader2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { tasksService, type Task, type TaskStatus } from '@/services/tasks.service';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  OPEN:        { label: 'Open',        icon: Circle,        color: 'text-slate-400' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock,         color: 'text-warning'   },
  COMPLETED:   { label: 'Completed',   icon: CheckCircle2,  color: 'text-success'   },
  CANCELLED:   { label: 'Cancelled',   icon: X,             color: 'text-slate-600' },
};

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  OPEN:        'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

// ─── Single task row ──────────────────────────────────────────────────────────

function TaskRow({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus, note?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState('');
  const cfg = STATUS_CONFIG[task.status];
  const Icon = cfg.icon;
  const next = NEXT_STATUS[task.status];

  const handleAdvance = () => {
    if (!next) return;
    if (next === 'COMPLETED') {
      setShowNoteInput(true);
    } else {
      onStatusChange(task.id, next);
    }
  };

  const handleComplete = () => {
    onStatusChange(task.id, 'COMPLETED', note.trim() || undefined);
    setShowNoteInput(false);
    setNote('');
  };

  return (
    <div className="flex flex-col gap-1.5 py-2.5 px-3 rounded-lg bg-surface-200/40">
      <div className="flex items-start gap-2">
        {/* Status toggle button */}
        <button
          onClick={handleAdvance}
          disabled={!next}
          className={`mt-0.5 shrink-0 transition-colors ${cfg.color} ${next ? 'hover:opacity-70 cursor-pointer' : 'cursor-default opacity-60'}`}
          title={next ? `Mark as ${STATUS_CONFIG[next].label}` : cfg.label}
        >
          <Icon className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${task.status === 'COMPLETED' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-[11px] text-slate-500 mt-0.5">{task.description}</p>
          )}
          {task.status === 'COMPLETED' && task.completionNote && (
            <p className="text-[11px] text-success/70 mt-0.5 italic">✓ {task.completionNote}</p>
          )}
          {task.status === 'COMPLETED' && task.completedBy && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              Completed by {task.completedBy.firstName} {task.completedBy.lastName}
            </p>
          )}
        </div>

        <span className={`shrink-0 text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>

        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors"
          title="Remove task"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Completion note input */}
      {showNoteInput && (
        <div className="flex gap-2 mt-1 pl-6">
          <input
            autoFocus
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleComplete();
              if (e.key === 'Escape') { setShowNoteInput(false); setNote(''); }
            }}
            placeholder="Add completion note (optional)"
            className="flex-1 rounded-md bg-surface-300/60 border border-surface-400/40 px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
          />
          <button
            onClick={handleComplete}
            className="shrink-0 rounded-md bg-success/20 border border-success/30 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/30 transition-colors"
          >
            Complete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Add task form ────────────────────────────────────────────────────────────

function AddTaskForm({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string, description?: string, assigneeUserId?: string, dueAt?: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => import('@/services/users.service').then((m) => m.usersService.listUsers()),
  });

  const submit = () => {
    if (!title.trim()) return;
    onAdd(
      title.trim(),
      description.trim() || undefined,
      assigneeUserId || undefined,
      dueAt || undefined,
    );
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-surface-300/30 border border-surface-400/30">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Task title…"
        className="rounded-md bg-surface-300/60 border border-surface-400/40 px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="rounded-md bg-surface-300/60 border border-surface-400/40 px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={assigneeUserId}
          onChange={(e) => setAssigneeUserId(e.target.value)}
          className="rounded-md bg-surface-300/60 border border-surface-400/40 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
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
          className="rounded-md bg-surface-300/60 border border-surface-400/40 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="rounded-md bg-brand-600 hover:bg-brand-500 disabled:opacity-40 px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          Add Task
        </button>
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Task panel ───────────────────────────────────────────────────────────────

interface TaskPanelProps {
  alertId?: string | null;
  leaseId?: string | null;
  propertyId?: string | null;
}

export function TaskPanel({ alertId, leaseId, propertyId }: TaskPanelProps) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);

  const filter = {
    ...(alertId    ? { alertId }    : {}),
    ...(leaseId    ? { leaseId }    : {}),
    ...(propertyId ? { propertyId } : {}),
  };

  const queryKey = ['tasks', filter];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => tasksService.getForItem(filter),
    enabled: expanded,
  });

  // Count open tasks without fetching — load once expanded
  const openCount = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
  const totalCount = tasks.length;

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (vars: { title: string; description?: string; assigneeUserId?: string; dueAt?: string }) =>
      tasksService.create({ ...vars, ...filter }),
    onSuccess: () => { invalidate(); setAdding(false); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: TaskStatus; note?: string }) =>
      tasksService.updateStatus(id, status, note),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksService.delete(id),
    onSuccess: invalidate,
  });

  const handleStatusChange = (id: string, status: TaskStatus, note?: string) =>
    statusMutation.mutate({ id, status, note });

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const handleAdd = (title: string, description?: string, assigneeUserId?: string, dueAt?: string) =>
    createMutation.mutate({ title, description, assigneeUserId, dueAt });

  return (
    <div className="mt-2 border-t border-surface-400/20 pt-2">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        {expanded
          ? <ChevronDown className="h-3 w-3" />
          : <ChevronRight className="h-3 w-3" />}
        <span className="font-medium">Tasks</span>
        {expanded && totalCount > 0 && (
          <span className="text-slate-600">
            {openCount > 0 ? `${openCount} open` : 'all done'}
          </span>
        )}
        {!expanded && (
          <span className="text-slate-600">expand to manage</span>
        )}
        {isLoading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-1.5">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}

          {tasks.length === 0 && !adding && (
            <p className="text-[11px] text-slate-600 py-1">No tasks yet.</p>
          )}

          {adding ? (
            <AddTaskForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-surface-400/50 px-3 py-2 text-xs font-medium text-slate-500 hover:border-brand-500/40 hover:text-brand-400 hover:bg-brand-600/5 transition-colors w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
