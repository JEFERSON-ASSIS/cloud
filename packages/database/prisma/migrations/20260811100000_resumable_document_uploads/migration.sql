CREATE TYPE "DocumentUploadStatus" AS ENUM (
    'ACTIVE',
    'FINALIZING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'EXPIRED'
);

CREATE TABLE "document_upload_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "folder_id" UUID,
    "sector_id" UUID,
    "storage_space_id" UUID,
    "storage_connection_id" UUID NOT NULL,
    "document_id" UUID,
    "name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "encrypted_resumable_uri" TEXT NOT NULL,
    "storage_file_id" TEXT,
    "bytes_uploaded" BIGINT NOT NULL DEFAULT 0,
    "status" "DocumentUploadStatus" NOT NULL DEFAULT 'ACTIVE',
    "error_message" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "document_upload_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_upload_sessions_document_id_key"
    ON "document_upload_sessions"("document_id");
CREATE INDEX "document_upload_sessions_organization_id_status_expires_at_idx"
    ON "document_upload_sessions"("organization_id", "status", "expires_at");
CREATE INDEX "document_upload_sessions_user_id_status_created_at_idx"
    ON "document_upload_sessions"("user_id", "status", "created_at");

ALTER TABLE "document_upload_sessions"
    ADD CONSTRAINT "document_upload_sessions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_upload_sessions"
    ADD CONSTRAINT "document_upload_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_upload_sessions"
    ADD CONSTRAINT "document_upload_sessions_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "folders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_upload_sessions"
    ADD CONSTRAINT "document_upload_sessions_sector_id_fkey"
    FOREIGN KEY ("sector_id") REFERENCES "sectors"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_upload_sessions"
    ADD CONSTRAINT "document_upload_sessions_storage_space_id_fkey"
    FOREIGN KEY ("storage_space_id") REFERENCES "storage_spaces"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_upload_sessions"
    ADD CONSTRAINT "document_upload_sessions_storage_connection_id_fkey"
    FOREIGN KEY ("storage_connection_id") REFERENCES "storage_connections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_upload_sessions"
    ADD CONSTRAINT "document_upload_sessions_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
