import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PageLoader } from '@/components/ui/Spinner';
import { UpgradeGate } from '@/components/ui/UpgradeGate';
import { useApplyTheme } from '@/lib/theme';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const AcceptInvitePage = lazy(() => import('@/features/auth/AcceptInvitePage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage'));
const ExportPage = lazy(() => import('@/features/export/ExportPage'));
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
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const CRMPage = lazy(() => import('@/features/crm/CRMPage'));
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'));
const AutomationPage = lazy(() => import('@/features/automation/AutomationPage'));
import LandingPageComponent from '@/features/landing/LandingPage';
const LandingPage = () => <LandingPageComponent />;
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));
const PricingPage = lazy(() => import('@/features/pricing/PricingPage'));
const ImportPage = lazy(() => import('@/features/import/ImportPage'));
const AuditPage = lazy(() => import('@/features/audit/AuditPage'));
const BillingSuccessPage = lazy(() => import('@/features/billing/BillingSuccessPage'));
const OrganizationPage = lazy(() => import('@/features/organization/OrganizationPage'));
const SupportPage = lazy(() => import('@/features/support/SupportPage'));
const MissionPage = lazy(() => import('@/features/about/MissionPage'));
const PrivacyTermsPage = lazy(() => import('@/features/about/PrivacyTermsPage'));
const DataControlsPage = lazy(() => import('@/features/about/DataControlsPage'));
const SecurityPage = lazy(() => import('@/features/about/SecurityPage'));
const TrashPage = lazy(() => import('@/features/trash/TrashPage'));
const BackupPage = lazy(() => import('@/features/backup/BackupPage'));

export default function App() {
  useApplyTheme();
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-surface-0"><PageLoader /></div>}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/mission" element={<MissionPage />} />
        <Route path="/privacy" element={<PrivacyTermsPage />} />
        <Route path="/data-controls" element={<DataControlsPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />

        {/* Auth */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/invite/:token" element={<AcceptInvitePage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />

        {/* Protected — setup outside AppLayout so it has its own full-page look */}
        <Route element={<ProtectedRoute />}>
          <Route path="setup" element={<SetupPage />} />
        </Route>

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="queue" element={<UpgradeGate feature="work_queue"><WorkQueuePage /></UpgradeGate>} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="leases" element={<LeasesPage />} />
            <Route path="leases/:id" element={<LeaseDetailPage />} />
            <Route path="properties" element={<PropertiesPage />} />
            <Route path="properties/:id" element={<PropertyDetailPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="benchmarks" element={<UpgradeGate feature="performance"><BenchmarksPage /></UpgradeGate>} />
            <Route path="simulator" element={<UpgradeGate feature="impact_analysis"><SimulatorPage /></UpgradeGate>} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="crm" element={<UpgradeGate feature="crm"><CRMPage /></UpgradeGate>} />
            <Route path="tasks" element={<UpgradeGate feature="tasks"><TasksPage /></UpgradeGate>} />
            <Route path="documents" element={<UpgradeGate feature="documents"><DocumentsPage /></UpgradeGate>} />
            <Route path="automation" element={<UpgradeGate feature="automation"><AutomationPage /></UpgradeGate>} />
            <Route path="import" element={<ImportPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="organization" element={<OrganizationPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="trash" element={<TrashPage />} />
            <Route path="backups" element={<BackupPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/queue" replace />} />
      </Routes>
    </Suspense>
  );
}
