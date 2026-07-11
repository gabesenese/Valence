import type { Alert } from '@/services/alerts.service';
import { withFocus } from '@/lib/focusSection';

export interface AlertDestination {
  to: string;
  label: string;
}

export function alertDestination(alert: Pick<Alert, 'type' | 'propertyId' | 'leaseId' | 'property' | 'lease'>): AlertDestination | null {
  const propertyId = alert.property?.id ?? alert.propertyId;
  const leaseId = alert.lease?.id ?? alert.leaseId;

  switch (alert.type) {
    case 'LEASE_EXPIRATION':
    case 'RENEWAL_RISK':
      return leaseId ? { to: withFocus(`/leases/${leaseId}`, 'renewal'), label: 'Review renewal' } : null;
    case 'OCCUPANCY_CHANGE':
      return propertyId ? { to: withFocus(`/properties/${propertyId}`, 'occupancy'), label: 'Review occupancy' } : null;
    case 'DATA_MISSING':
      return propertyId ? { to: withFocus(`/properties/${propertyId}`, 'missing-data'), label: 'Review property' } : null;
    case 'COMPLIANCE_FLAG':
      return propertyId ? { to: withFocus(`/properties/${propertyId}`, 'compliance'), label: 'Review compliance' } : null;
    case 'PAYMENT_ANOMALY':
      return { to: withFocus('/finance?tab=ledger', 'transaction'), label: 'Review ledger' };
    case 'FINANCIAL_DISCREPANCY':
      return { to: withFocus('/finance?tab=ledger', 'revenue'), label: 'Review finance' };
    default:
      return propertyId ? { to: `/properties/${propertyId}`, label: 'Review' } : null;
  }
}
