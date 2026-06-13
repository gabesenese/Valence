import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Plus, Play, ToggleLeft, ToggleRight, CheckCircle,
  Clock, Calendar, AlertTriangle, ClipboardList, X, ChevronDown,
} from 'lucide-react';
import {
  automationService,
  type AutomationRule,
  type AutomationTrigger,
  type AutomationAction,
  type RuleConditions,
  type ActionConfig,
} from '@/services/automation.service';
import { useAuthStore } from '@/state/auth.store';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PageLoader } from '@/components/ui/Spinner';

// ─── Config ───────────────────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<AutomationTrigger, { label: string; description: string; conditionKey: keyof RuleConditions; conditionLabel: string; defaultValue: number }> = {
  LEASE_DAYS_REMAINING: {
    label: 'Lease days remaining',
    description: 'Triggers when a lease is X days from expiration',
    conditionKey: 'daysRemaining',
    conditionLabel: 'Days before expiry',
    defaultValue: 90,
  },
  PAYMENT_OVERDUE_DAYS: {
    label: 'Payment overdue',
    description: 'Triggers when a payment is X days past due',
    conditionKey: 'overdueDays',
    conditionLabel: 'Days overdue',
    defaultValue: 14,
  },
  OCCUPANCY_BELOW: {
    label: 'Occupancy below threshold',
    description: 'Triggers when property occupancy falls below X%',
    conditionKey: 'occupancyPct',
    conditionLabel: 'Occupancy % threshold',
    defaultValue: 80,
  },
  RISK_SCORE_ABOVE: {
    label: 'Risk score above threshold',
    description: 'Triggers when property risk score exceeds X',
    conditionKey: 'riskScore',
    conditionLabel: 'Risk score threshold',
    defaultValue: 50,
  },
};

const ACTION_CONFIG: Record<AutomationAction, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  CREATE_TASK:      { label: 'Create Task',       icon: ClipboardList },
  NOTIFY_ASSIGNEE:  { label: 'Notify Assignee',   icon: AlertTriangle },
  ESCALATE_ALERT:   { label: 'Escalate Alert',    icon: AlertTriangle },
};

function formatDate(s: string | null) {
  if (!s) return 'Never';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Create rule modal ────────────────────────────────────────────────────────

function CreateRuleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState<AutomationTrigger>('LEASE_DAYS_REMAINING');
  const [conditionValue, setConditionValue] = useState(90);
  const [action, setAction] = useState<AutomationAction>('CREATE_TASK');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [assignTo, setAssignTo] = useState('lease_owner');
  const [daysUntilDue, setDaysUntilDue] = useState(7);

  const trig = TRIGGER_CONFIG[trigger];

  const mutation = useMutation({
    mutationFn: () => {
      const conditions: RuleConditions = { [trig.conditionKey]: conditionValue };
      const actionConfig: ActionConfig = {
        taskTitle: taskTitle || `Lease expiring in {days} days — {tenant}`,
        taskDescription: taskDescription || undefined,
        assignTo: assignTo || undefined,
        daysUntilDue,
      };
      return automationService.createRule({ name: name.trim(), description: description.trim() || undefined, trigger, conditions, action, actionConfig });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automation-rules'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl border border-surface-400/40 bg-surface-100 p-6 shadow-xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-base font-semibold text-white mb-5">New Automation Rule</h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Rule Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 90-day lease renewal reminder"
              className="w-full rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            />
          </div>

          {/* Trigger */}
          <div className="rounded-xl border border-surface-400/40 bg-surface-200/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">When (Trigger)</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(Object.keys(TRIGGER_CONFIG) as AutomationTrigger[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTrigger(t); setConditionValue(TRIGGER_CONFIG[t].defaultValue); }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    trigger === t
                      ? 'border-brand-500/40 bg-brand-600/10 text-brand-300'
                      : 'border-surface-400/40 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <p className="font-medium">{TRIGGER_CONFIG[t].label}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mb-2">{trig.description}</p>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">{trig.conditionLabel}</label>
              <input
                type="number"
                value={conditionValue}
                onChange={(e) => setConditionValue(Number(e.target.value))}
                className="w-full rounded-lg border border-surface-400/40 bg-surface-300/60 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
            </div>
          </div>

          {/* Action */}
          <div className="rounded-xl border border-surface-400/40 bg-surface-200/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Then (Action)</p>
            <div className="flex gap-2 mb-3">
              {(Object.keys(ACTION_CONFIG) as AutomationAction[]).map((a) => {
                const cfg = ACTION_CONFIG[a];
                const Icon = cfg.icon;
                return (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      action === a
                        ? 'border-brand-500/40 bg-brand-600/10 text-brand-300'
                        : 'border-surface-400/40 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {action === 'CREATE_TASK' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 mb-1 block">
                    Task Title <span className="text-slate-600">(use {'{tenant}'}, {'{property}'}, {'{days}'})</span>
                  </label>
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Lease expiring in {days} days — {tenant}"
                    className="w-full rounded-lg border border-surface-400/40 bg-surface-300/60 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 mb-1 block">Task Description</label>
                  <input
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-surface-400/40 bg-surface-300/60 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Assign To</label>
                    <Select
                      value={assignTo}
                      onChange={setAssignTo}
                      options={[
                        { value: 'lease_owner', label: 'Lease Owner' },
                        { value: 'manager',     label: 'Assigned Manager' },
                        { value: '',            label: 'Unassigned' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Due In (days)</label>
                    <input
                      type="number"
                      value={daysUntilDue}
                      onChange={(e) => setDaysUntilDue(Number(e.target.value))}
                      className="w-full rounded-lg border border-surface-400/40 bg-surface-300/60 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!name.trim()}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Create Rule
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({ rule, canEdit }: { rule: AutomationRule; canEdit: boolean }) {
  const qc = useQueryClient();
  const [showLogs, setShowLogs] = useState(false);
  const trig = TRIGGER_CONFIG[rule.trigger];
  const ActionIcon = ACTION_CONFIG[rule.action].icon;

  const toggleMutation = useMutation({
    mutationFn: () => automationService.updateRule(rule.id, { isActive: !rule.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const runMutation = useMutation({
    mutationFn: () => automationService.runRule(rule.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-rules'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['automation-logs', rule.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => automationService.deleteRule(rule.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['automation-logs', rule.id],
    queryFn: () => automationService.getLogs(rule.id),
    enabled: showLogs,
  });

  const conditionVal = (rule.conditions as RuleConditions)[trig.conditionKey];

  return (
    <div className={!rule.isActive ? 'opacity-50' : undefined}>
      <div className="flex items-start gap-4 px-4 py-3.5">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${rule.isActive ? 'bg-brand-600/20' : 'bg-surface-300/50'}`}>
          <Zap className={`h-4 w-4 ${rule.isActive ? 'text-brand-400' : 'text-slate-500'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-white">{rule.name}</p>
            <Badge variant={rule.isActive ? 'success' : 'neutral'}>{rule.isActive ? 'Active' : 'Paused'}</Badge>
          </div>
          {rule.description && <p className="text-xs text-slate-500 mb-2">{rule.description}</p>}

          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-600" />
              {trig.label}: {conditionVal} {trig.conditionKey === 'occupancyPct' || trig.conditionKey === 'riskScore' ? '' : 'days'}
            </span>
            <span className="flex items-center gap-1">
              <ActionIcon className="h-3 w-3 text-slate-600" />
              {ACTION_CONFIG[rule.action].label}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-600" />
              Last run: {formatDate(rule.lastRunAt)}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-slate-600" />
              {rule._count.logs} run{rule._count.logs !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runMutation.mutate()}
              loading={runMutation.isPending}
              title="Run now"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <button
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              title={rule.isActive ? 'Pause' : 'Activate'}
              className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
            >
              {rule.isActive
                ? <ToggleRight className="h-5 w-5 text-success" />
                : <ToggleLeft className="h-5 w-5" />}
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="p-1.5 text-slate-600 hover:text-danger transition-colors"
              title="Delete rule"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Logs toggle */}
      <div className="border-t border-surface-400/20">
        <button
          onClick={() => setShowLogs((p) => !p)}
          className="flex w-full items-center gap-1.5 px-4 py-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showLogs ? 'rotate-180' : ''}`} />
          Recent runs
        </button>
        {showLogs && (
          <div className="px-4 pb-3">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-600">No runs yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {log.outcome === 'SUCCESS'
                        ? <CheckCircle className="h-3 w-3 text-success" />
                        : <AlertTriangle className="h-3 w-3 text-danger" />}
                      <span className="text-slate-400">
                        {log.tasksCreated} task{log.tasksCreated !== 1 ? 's' : ''} created
                      </span>
                    </div>
                    <span className="text-slate-600">
                      {new Date(log.triggeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [showCreate, setShowCreate] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: automationService.getRules,
  });

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="flex flex-col gap-4 p-5 animate-fade-in">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-brand-400" />
          <span className="text-sm font-semibold text-white">Automation Rules</span>
          <span className="text-xs text-slate-500">{activeCount} active · {rules.length} total</span>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Rule
          </Button>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-surface-400/30 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300/60">
            <Zap className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-300">No automation rules yet</p>
            <p className="mt-1 text-xs text-slate-600 max-w-xs leading-relaxed">
              Rules run hourly and automatically create tasks when triggers fire — keeping your team ahead of issues.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create First Rule
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-surface-400/30 overflow-hidden divide-y divide-surface-400/20">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} canEdit={canEdit} />
          ))}
        </div>
      )}

      {showCreate && <CreateRuleModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
