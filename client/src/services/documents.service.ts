import { api, extractData } from './api';

export type DocumentType =
  | 'LEASE'
  | 'INSURANCE'
  | 'INSPECTION'
  | 'PERMIT'
  | 'AMENDMENT'
  | 'NOTICE'
  | 'FINANCIAL'
  | 'OTHER';

export interface Document {
  id: string;
  name: string;
  originalName: string;
  type: DocumentType;
  mimeType: string;
  size: number;
  path: string;
  propertyId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  createdAt: string;
  uploadedBy: { id: string; firstName: string; lastName: string } | null;
  property: { id: string; name: string; code: string } | null;
  lease: { id: string; leaseNumber: string } | null;
  tenant: { id: string; name: string } | null;
}

export const documentsService = {
  getDocuments: (params?: {
    propertyId?: string;
    leaseId?: string;
    tenantId?: string;
    type?: DocumentType;
  }) => api.get('/documents', { params }).then(extractData<Document[]>),

  uploadDocument: (
    file: File,
    meta: {
      type?: DocumentType;
      name?: string;
      propertyId?: string;
      leaseId?: string;
      tenantId?: string;
    },
  ) => {
    const form = new FormData();
    form.append('file', file);
    if (meta.type) form.append('type', meta.type);
    if (meta.name) form.append('name', meta.name);
    if (meta.propertyId) form.append('propertyId', meta.propertyId);
    if (meta.leaseId) form.append('leaseId', meta.leaseId);
    if (meta.tenantId) form.append('tenantId', meta.tenantId);
    return api
      .post('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(extractData<Document>);
  },

  deleteDocument: (id: string) =>
    api.delete(`/documents/${id}`).then(extractData<{ deleted: boolean }>),
};
