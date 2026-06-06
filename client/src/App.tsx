import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PageLoader } from '@/components/ui/Spinner';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const LeasesPage = lazy(() => import('@/features/leases/LeasesPage'));
const LeaseDetailPage = lazy(() => import('@/features/leases/LeaseDetailPage'));
const PropertiesPage = lazy(() => import('@/features/properties/PropertiesPage'));
const PropertyDetailPage = lazy(() => import('@/features/properties/PropertyDetailPage'));
const FinancePage = lazy(() => import('@/features/finance/FinancePage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const AlertsPage = lazy(() => import('@/features/alerts/AlertsPage'));
const TenantsPage = lazy(() => import('@/features/tenants/TenantsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const SetupPage = lazy(() => import('@/features/setup/SetupPage'));
const WorkQueuePage = lazy(() => import('@/features/workQueue/WorkQueuePage'));
const BenchmarksPage = lazy(() => import('@/features/benchmarks/BenchmarksPage'));
const SimulatorPage = lazy(() => import('@/features/simulator/SimulatorPage'));
const TeamPage = lazy(() => import('@/features/team/TeamPage'));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const CRMPage = lazy(() => import('@/features/crm/CRMPage'));
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'));
const AutomationPage = lazy(() => import('@/features/automation/AutomationPage'));

export default function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-surface-0"><PageLoader /></div>}>
      <Routes>
        {/* Auth */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />

        {/* Protected — setup outside AppLayout so it has its own full-page look */}
        <Route element={<ProtectedRoute />}>
          <Route path="setup" element={<SetupPage />} />
        </Route>

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<WorkQueuePage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="leases" element={<LeasesPage />} />
            <Route path="leases/:id" element={<LeaseDetailPage />} />
            <Route path="properties" element={<PropertiesPage />} />
            <Route path="properties/:id" element={<PropertyDetailPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="benchmarks" element={<BenchmarksPage />} />
            <Route path="simulator" element={<SimulatorPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="crm" element={<CRMPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="automation" element={<AutomationPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
