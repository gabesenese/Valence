-- CreateEnum
CREATE TYPE "CrmStatus" AS ENUM ('ACTIVE', 'AT_RISK', 'HIGH_VALUE', 'CHURNED');

-- CreateEnum
CREATE TYPE "ContactLogType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'SITE_VISIT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LEASE', 'INSURANCE', 'INSPECTION', 'PERMIT', 'AMENDMENT', 'NOTICE', 'FINANCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('LEASE_DAYS_REMAINING', 'PAYMENT_OVERDUE_DAYS', 'OCCUPANCY_BELOW', 'RISK_SCORE_ABOVE');

-- CreateEnum
CREATE TYPE "AutomationAction" AS ENUM ('CREATE_TASK', 'NOTIFY_ASSIGNEE', 'ESCALATE_ALERT');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "assigned_manager_id" TEXT,
ADD COLUMN     "crm_status" "CrmStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "last_contact_at" TIMESTAMP(3),
ADD COLUMN     "renewal_probability" INTEGER;

-- CreateTable
CREATE TABLE "contact_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lease_id" TEXT,
    "type" "ContactLogType" NOT NULL,
    "body" TEXT NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "property_id" TEXT,
    "lease_id" TEXT,
    "tenant_id" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "AutomationTrigger" NOT NULL,
    "conditions" JSONB NOT NULL,
    "action" "AutomationAction" NOT NULL,
    "action_config" JSONB NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_logs" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "tasks_created" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_logs_tenant_id_idx" ON "contact_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "contact_logs_lease_id_idx" ON "contact_logs"("lease_id");

-- CreateIndex
CREATE INDEX "contact_logs_created_at_idx" ON "contact_logs"("created_at");

-- CreateIndex
CREATE INDEX "documents_property_id_idx" ON "documents"("property_id");

-- CreateIndex
CREATE INDEX "documents_lease_id_idx" ON "documents"("lease_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "automation_rules_is_active_idx" ON "automation_rules"("is_active");

-- CreateIndex
CREATE INDEX "automation_rules_trigger_idx" ON "automation_rules"("trigger");

-- CreateIndex
CREATE INDEX "automation_logs_rule_id_idx" ON "automation_logs"("rule_id");

-- CreateIndex
CREATE INDEX "automation_logs_triggered_at_idx" ON "automation_logs"("triggered_at");

-- CreateIndex
CREATE INDEX "tenants_assigned_manager_id_idx" ON "tenants"("assigned_manager_id");

-- CreateIndex
CREATE INDEX "tenants_crm_status_idx" ON "tenants"("crm_status");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_assigned_manager_id_fkey" FOREIGN KEY ("assigned_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
