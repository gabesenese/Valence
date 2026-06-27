import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, FileText, ShieldCheck } from 'lucide-react';
import { documentsService, type DocumentType } from '@/services/documents.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import LeaseVerifyModal from './LeaseVerifyModal';

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  LEASE:      'Lease Agreement',
  AMENDMENT:  'Amendment',
  INSURANCE:  'Insurance',
  INSPECTION: 'Inspection',
  PERMIT:     'Permit',
  NOTICE:     'Notice',
  FINANCIAL:  'Financial',
  OTHER:      'Other',
};
const DOC_TYPES = Object.keys(DOC_TYPE_LABEL) as DocumentType[];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function LeaseDocuments({ leaseId }: { leaseId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>('LEASE');
  const [verifyOpen, setVerifyOpen] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', { leaseId }],
    queryFn: () => documentsService.getDocuments({ leaseId }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['documents', { leaseId }] });

  const upload = useMutation({
    mutationFn: (file: File) => documentsService.uploadDocument(file, { leaseId, type: docType }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => documentsService.deleteDocument(id),
    onSuccess: invalidate,
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setVerifyOpen(true)}>
            <ShieldCheck className="h-3.5 w-3.5" /> Verify
          </Button>
          <Select
            value={docType}
            onChange={(v) => setDocType(v as DocumentType)}
            options={DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] }))}
            className="w-40"
          />
          <Button size="sm" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
          <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-slate-500">
            No documents attached yet. Upload the lease agreement, amendments, insurance certificates, or inspection reports for this lease.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-400/20">
            {docs.map((d) => (
              <li key={d.id} className="group flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-brand-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200">{d.name}</p>
                    <p className="text-xs text-slate-500">{DOC_TYPE_LABEL[d.type]} · {formatSize(d.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => remove.mutate(d.id)}
                  disabled={remove.isPending}
                  title="Delete document"
                  className="shrink-0 text-slate-600 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {upload.isError && <p className="mt-2 text-xs text-danger">Upload failed — files must be under 25 MB.</p>}
      </CardBody>
      <LeaseVerifyModal open={verifyOpen} onClose={() => setVerifyOpen(false)} leaseId={leaseId} />
    </Card>
  );
}
