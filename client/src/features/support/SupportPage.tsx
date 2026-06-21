import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  MessageSquare, Bug, Lightbulb, X,
  Paperclip, Send, Loader2, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { supportService, type SupportCategory } from '@/services/support.service';

// ─── Action cards config ──────────────────────────────────────────────────────

const ACTIONS = [
  {
    cat:         'General Support' as SupportCategory,
    icon:        MessageSquare,
    title:       'Need Help?',
    description: 'Email support@valenceos.ca',
    color:       'text-blue-400',
    bg:          'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15',
    activeBg:    'bg-blue-500/15 border-blue-500/30',
  },
  {
    cat:         'Bug Report' as SupportCategory,
    icon:        Bug,
    title:       'Report a Bug',
    description: 'Send an issue to engineering',
    color:       'text-danger',
    bg:          'bg-danger/10 border-danger/20 hover:bg-danger/15',
    activeBg:    'bg-danger/15 border-danger/30',
  },
  {
    cat:         'Feature Request' as SupportCategory,
    icon:        Lightbulb,
    title:       'Request a Feature',
    description: 'Share your idea with us',
    color:       'text-brand-400',
    bg:          'bg-brand-600/10 border-brand-500/20 hover:bg-brand-600/15',
    activeBg:    'bg-brand-600/15 border-brand-500/30',
  },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [activeCategory, setActiveCategory] = useState<SupportCategory | null>(null);
  const [subject,        setSubject]         = useState('');
  const [message,        setMessage]         = useState('');
  const [screenshot,     setScreenshot]      = useState<string | null>(null);
  const [screenshotName, setScreenshotName]  = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () => supportService.submitTicket({
      category:    activeCategory!,
      subject,
      message,
      screenshot,
      pageUrl:     window.location.href,
      browserInfo: navigator.userAgent,
    }),
    onSuccess: () => {
      setTimeout(() => {
        setActiveCategory(null);
        setSubject(''); setMessage('');
        setScreenshot(null); setScreenshotName('');
        mutation.reset();
      }, 3500);
    },
  });

  function openForm(cat: SupportCategory) {
    setActiveCategory(cat);
    setSubject(''); setMessage('');
    setScreenshot(null); setScreenshotName('');
    mutation.reset();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  }

  const activeMeta = ACTIONS.find(a => a.cat === activeCategory);

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader title="Support" description="We're here to help" />

      {/* Action cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 max-w-3xl">
        {ACTIONS.map(({ cat, icon: Icon, title, description, color, bg, activeBg }) => (
          <button
            key={cat}
            onClick={() => openForm(cat)}
            className={cn(
              'flex flex-col gap-3 rounded-2xl border px-5 py-5 text-left transition-colors',
              activeCategory === cat ? activeBg : bg,
            )}
          >
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', activeCategory === cat ? 'bg-white/5' : 'bg-black/10')}>
              <Icon className={cn('h-5 w-5', color)} />
            </div>
            <div>
              <p className={cn('text-sm font-semibold', color)}>{title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Form */}
      {activeCategory && activeMeta && (
        <div className="max-w-xl rounded-2xl border border-surface-400/30 bg-surface-100 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
              activeCategory === 'Bug Report'      && 'text-danger bg-danger/10 border-danger/20',
              activeCategory === 'Feature Request' && 'text-brand-400 bg-brand-600/10 border-brand-500/20',
              activeCategory === 'General Support' && 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            )}>
              <activeMeta.icon className="h-3 w-3" />
              {activeCategory}
            </span>
            <button onClick={() => setActiveCategory(null)} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {activeCategory === 'Bug Report' && (
            <div className="rounded-lg bg-surface-300/40 border border-surface-400/20 px-3 py-2">
              <p className="text-[11px] text-slate-500">Auto-included: your account, current page URL, browser info, and timestamp.</p>
            </div>
          )}

          {mutation.isSuccess ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <p className="text-sm font-medium text-success">Message sent — we'll be in touch shortly.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-500">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder={
                    activeCategory === 'Bug Report'      ? 'e.g. Dashboard not loading after login' :
                    activeCategory === 'Feature Request' ? 'e.g. Export leases to CSV' :
                    'How can we help?'
                  }
                  className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-fg placeholder-slate-600 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-500">Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={
                    activeCategory === 'Bug Report'      ? 'Describe what happened and what you expected…' :
                    activeCategory === 'Feature Request' ? 'Describe the feature and how it would help your workflow…' :
                    'Tell us what you need help with…'
                  }
                  className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-fg placeholder-slate-600 focus:border-brand-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-500">Screenshot (optional)</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-surface-400/50 bg-surface-200/50 px-3 py-2 text-xs text-slate-500 hover:border-brand-500/50 hover:text-slate-400 transition-colors w-fit">
                  <Paperclip className="h-3.5 w-3.5" />
                  {screenshotName || 'Attach a screenshot'}
                </button>
                {screenshot && (
                  <button type="button" onClick={() => { setScreenshot(null); setScreenshotName(''); }}
                    className="text-[11px] text-slate-600 hover:text-danger transition-colors w-fit">
                    Remove
                  </button>
                )}
              </div>

              {mutation.isError && (
                <p className="text-xs text-danger">{(mutation.error as Error)?.message ?? 'Failed to send. Please try again.'}</p>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={() => setActiveCategory(null)} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !subject.trim() || !message.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
