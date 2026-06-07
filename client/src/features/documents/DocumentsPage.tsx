import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Upload, Trash2, Search, Filter,
  File, Shield, ClipboardCheck, DollarSign, FileCheck, Bell, FolderOpen,
} from 'lucide-react';
import { documentsService, type Document, type DocumentType } from '@/services/documents.service';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Config ───────────────────────────────────────────────────────────────────

const DOC_TYPE_CONFIG: Record<DocumentType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  LEASE:       { label: 'Lease',       icon: FileText,      color: 'text-brand-400'  },
  INSURANCE:   { label: 'Insurance',   icon: Shield,        color: 'text-success'    },
  INSPECTION:  { label: 'Inspection',  icon: ClipboardCheck,color: 'text-warning'    },
  PERMIT:      { label: 'Permit',      icon: FileCheck,     color: 'text-info'       },
  AMENDMENT:   { label: 'Amendment',   icon: FileText,      color: 'text-purple-400' },
  NOTICE:      { label: 'Notice',      icon: Bell,          color: 'text-danger'     },
  FINANCIAL:   { label: 'Financial',   icon: DollarSign,    color: 'text-teal-400'   },
  OTHER:       { label: 'Other',       icon: File,          color: 'text-slate-400'  },
};

const DOC_TYPES: DocumentType[] = [
  'LEASE', 'INSURANCE', 'INSPECTION', 'PERMIT', 'AMENDMENT', 'NOTICE', 'FINANCIAL', 'OTHER',
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('OTHER');
  const [name, setName] = useState('');
  const [dragging, setDragging] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file');
      return documentsService.uploadDocument(file, {
        type: docType,
        name: name.trim() || file.name,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      onClose();
    },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) { setFile(dropped); if (!name) setName(dropped.name); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-surface-400/40 bg-surface-100 p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white mb-4">Upload Document</h2>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            dragging ? 'border-brand-500/60 bg-brand-600/10' : 'border-surface-400/50 hover:border-brand-500/30 hover:bg-surface-200/20'
          }`}
        >
          <Upload className="h-8 w-8 text-slate-500 mb-2" />
          {file ? (
            <p className="text-sm font-medium text-slate-300">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-slate-400">Drag & drop or click to select</p>
              <p className="text-xs text-slate-600 mt-1">Max 25 MB</p>
            </>
          )}
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); if (!name) setName(f.name); }
          }} />
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Document name"
            className="rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
          />
          <Select
            size="md"
            value={docType}
            onChange={(v) => setDocType(v as DocumentType)}
            options={DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_CONFIG[t].label }))}
          />
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!file}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Upload
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocRow({ doc, onDelete }: { doc: Document; onDelete: (id: string) => void }) {
  const cfg = DOC_TYPE_CONFIG[doc.type];
  const Icon = cfg.icon;

  return (
    <tr className="border-b border-surface-400/30 hover:bg-surface-200/30 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300/50">
            <Icon className={`h-4 w-4 ${cfg.color}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{doc.name}</p>
            <p className="text-xs text-slate-500">{doc.originalName}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="neutral">{cfg.label}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {doc.property && <span className="text-xs text-slate-400">{doc.property.name}</span>}
          {doc.lease && <span className="text-xs text-slate-500">{doc.lease.leaseNumber}</span>}
          {doc.tenant && <span className="text-xs text-slate-500">{doc.tenant.name}</span>}
          {!doc.property && !doc.lease && !doc.tenant && <span className="text-xs text-slate-600">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{formatSize(doc.size)}</td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete(doc.id)}
            className="text-slate-600 hover:text-danger transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | ''>('');
  const [showUpload, setShowUpload] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', { typeFilter }],
    queryFn: () => documentsService.getDocuments({ type: typeFilter || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: documentsService.deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const filtered = search
    ? docs.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.originalName.toLowerCase().includes(search.toLowerCase()) ||
          d.property?.name.toLowerCase().includes(search.toLowerCase()) ||
          d.lease?.leaseNumber.toLowerCase().includes(search.toLowerCase()) ||
          d.tenant?.name.toLowerCase().includes(search.toLowerCase()),
      )
    : docs;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Documents</h1>
          <p className="mt-0.5 text-sm text-slate-500">{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          <Select
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as DocumentType | '')}
            options={[
              { value: '', label: 'All types' },
              ...DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_CONFIG[t].label })),
            ]}
            className="w-36"
          />
        </div>
      </div>

      <Card>
        {isLoading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            action={
              <Button size="sm" onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4" />
                Upload your first document
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {['Document', 'Type', 'Linked To', 'Size', 'Uploaded By', 'Date', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
