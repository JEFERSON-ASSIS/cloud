ALTER TABLE "google_drive_connections"
  ADD COLUMN "quota_used" BIGINT,
  ADD COLUMN "quota_limit" BIGINT;

ALTER TABLE "folders" ADD COLUMN "previous_parent_id" UUID;
ALTER TABLE "documents" ADD COLUMN "previous_folder_id" UUID;

CREATE INDEX "folders_organization_id_parent_id_deleted_at_idx"
  ON "folders"("organization_id", "parent_id", "deleted_at");
CREATE INDEX "documents_organization_id_status_deleted_at_idx"
  ON "documents"("organization_id", "status", "deleted_at");
