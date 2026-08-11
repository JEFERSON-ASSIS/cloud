CREATE TYPE "DocumentSharePermission" AS ENUM ('VIEW', 'DOWNLOAD');

CREATE TABLE "document_shares" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "resource_key" TEXT NOT NULL,
    "document_id" UUID,
    "folder_id" UUID,
    "source_sector_id" UUID NOT NULL,
    "target_sector_id" UUID NOT NULL,
    "target_user_id" UUID,
    "audience_key" TEXT NOT NULL,
    "permission" "DocumentSharePermission" NOT NULL DEFAULT 'VIEW',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "document_shares_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_shares_single_resource_check"
      CHECK (num_nonnulls("document_id", "folder_id") = 1),
    CONSTRAINT "document_shares_distinct_sectors_check"
      CHECK ("source_sector_id" <> "target_sector_id")
);

CREATE UNIQUE INDEX "document_shares_organization_id_resource_key_target_sector_id_audience_key_key"
    ON "document_shares"("organization_id", "resource_key", "target_sector_id", "audience_key");
CREATE INDEX "document_shares_target_sector_id_target_user_id_revoked_at_idx"
    ON "document_shares"("target_sector_id", "target_user_id", "revoked_at");
CREATE INDEX "document_shares_document_id_revoked_at_idx"
    ON "document_shares"("document_id", "revoked_at");
CREATE INDEX "document_shares_folder_id_revoked_at_idx"
    ON "document_shares"("folder_id", "revoked_at");

ALTER TABLE "document_shares"
    ADD CONSTRAINT "document_shares_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_shares"
    ADD CONSTRAINT "document_shares_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_shares"
    ADD CONSTRAINT "document_shares_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "folders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_shares"
    ADD CONSTRAINT "document_shares_source_sector_id_fkey"
    FOREIGN KEY ("source_sector_id") REFERENCES "sectors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_shares"
    ADD CONSTRAINT "document_shares_target_sector_id_fkey"
    FOREIGN KEY ("target_sector_id") REFERENCES "sectors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_shares"
    ADD CONSTRAINT "document_shares_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_shares"
    ADD CONSTRAINT "document_shares_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
