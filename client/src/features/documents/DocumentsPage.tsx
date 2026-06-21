import { useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Upload, Trash2, Filter,
  File, Shield, ClipboardCheck, DollarSign, FileCheck, Bell, FolderOpen,
} from 'lucide-react';
import { documentsService, type Document, type DocumentType } from '@/services/documents.service';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';

// ─── Config ───────────────────────────────────────────────────────────────────

const DOC_TYPE_CONFIG: Record<DocumentType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  LEASE:       { label: 'Lease',       icon: FileText,       color: 'text-brand-400'  },
  INSURANCE:   { label: 'Insurance',   icon: Shield,         color: 'text-success'    },
  INSPECTION:  { label: 'Inspection',  icon: ClipboardCheck, color: 'text-warning'    },
  PERMIT:      { label: 'Permit',      icon: FileCheck,      color: 'text-info'       },
  AMENDMENT:   { label: 'Amendment',  icon: FileText,       color: 'text-purple-400' },
  NOTICE:      { label: 'Notice',      icon: Bell,           color: 'text-danger'     },
  FINANCIAL:   { label: 'Financial',   icon: DollarSign,     color: 'text-teal-400'   },
  OTHER:       { label: 'Other',       icon: File,           color: 'text-slate-400'  },
};

const DOC_TYPES: DocumentType[] = [
  'LEASE', 'INSURANCE', 'INSPECTION', 'PERMIT', 'AMENDMENT', 'NOTICE', 'FINANCIAL', 'OTHER',
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function buildColumns(onDelete: (id: string) => void): Column<Document>[] {
  return [
    {
      key: 'document',
      header: 'Document',
      render: (doc) => {
        const cfg = DOC_TYPE_CONFIG[doc.type];
        const Icon = cfg.icon;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300/50">
              <Icon className={`h-4 w-4 ${cfg.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{doc.name}</p>
              <p className="text-xs text-slate-500">{doc.originalName}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (doc) => <Badge variant="neutral">{DOC_TYPE_CONFIG[doc.type].label}</Badge>,
    },
    {
      key: 'linkedTo',
      header: 'Linked To',
      render: (doc) => (
        <div className="flex flex-col gap-0.5">
          {doc.property && <span className="text-xs text-slate-400">{doc.property.name}</span>}
          {doc.lease && <span className="text-xs text-slate-500">{doc.lease.leaseNumber}</span>}
          {doc.tenant && <span className="text-xs text-slate-500">{doc.tenant.name}</span>}
          {!doc.property && !doc.lease && !doc.tenant && <span className="text-xs text-slate-600">—</span>}
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (doc) => <span className="text-xs text-slate-500">{formatSize(doc.size)}</span>,
    },
    {
      key: 'uploadedBy',
      header: 'Uploaded By',
      render: (doc) => (
        <span className="text-xs text-slate-500">
          {doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : '—'}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (doc) => (
        <span className="text-xs text-slate-600">
          {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      render: (doc) => (
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
            className="text-slate-600 hover:text-danger transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];
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
      return documentsService.uploadDocument(file, { type: docType, name: name.trim() || file.name });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['onboarding'] }); onClose(); },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) { setFile(dropped); if (!name) setName(dropped.name); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl border border-surface-400/40 bg-surface-100 p-6 shadow-xl">
        <h2 className="text-base font-semibold text-fg mb-4">Upload Document</h2>
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
          <Button size="sm" disabled={!file} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Upload
          </Button>
        </div>
      </div>
    </div>
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

  const filtered = useMemo(() => {
    if (!search) return docs;
    const q = search.toLowerCase();
    return docs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.originalName.toLowerCase().includes(q) ||
        d.property?.name.toLowerCase().includes(q) ||
        d.lease?.leaseNumber.toLowerCase().includes(q) ||
        d.tenant?.name.toLowerCase().includes(q),
    );
  }, [docs, search]);

  const columns = useMemo(() => buildColumns((id) => deleteMutation.mutate(id)), [deleteMutation]);

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Documents"
        description={`${docs.length} document${docs.length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(d) => d.id}
        loading={isLoading}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search documents…"
        filters={
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
        }
        emptyIcon={FolderOpen}
        emptyTitle="No documents yet"
        emptyAction={
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" />
            Upload your first document
          </Button>
        }
      />

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
