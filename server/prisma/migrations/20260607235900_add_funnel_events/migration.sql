-- CreateTable
CREATE TABLE "funnel_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "user_id" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funnel_events_event_created_at_idx" ON "funnel_events"("event", "created_at");

-- CreateIndex
CREATE INDEX "funnel_events_user_id_idx" ON "funnel_events"("user_id");
