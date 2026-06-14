-- Add soft-delete support to tasks
ALTER TABLE "tasks" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Index for efficient trash queries
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at");
