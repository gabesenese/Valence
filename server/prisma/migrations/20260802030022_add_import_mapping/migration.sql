-- DropIndex
DROP INDEX "users_is_demo_idx";

-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "import_type" TEXT NOT NULL,
    "column_map" JSONB NOT NULL,
    "defaults" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_mappings_user_id_import_type_key" ON "import_mappings"("user_id", "import_type");

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "integration_mappings_owner_id_provider_source_type_source_value" RENAME TO "integration_mappings_owner_id_provider_source_type_source_v_key";
