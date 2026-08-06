-- CreateEnum
CREATE TYPE "SectorRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER_DOWNLOAD', 'VIEWER_ONLY', 'NO_ACCESS');

-- DropIndex
DROP INDEX "documents_organization_id_status_deleted_at_idx";

-- DropIndex
DROP INDEX "folders_organization_id_parent_id_deleted_at_idx";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "sector_id" UUID,
ADD COLUMN     "storage_space_id" UUID;

-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "sector_id" UUID,
ADD COLUMN     "storage_space_id" UUID;

-- CreateTable
CREATE TABLE "sectors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quota_limit" BIGINT NOT NULL DEFAULT 1073741824,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector_users" (
    "id" UUID NOT NULL,
    "sector_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "SectorRole" NOT NULL DEFAULT 'VIEWER_DOWNLOAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sector_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_spaces" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sector_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "root_folder_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "storage_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sectors_organization_id_name_key" ON "sectors"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sector_users_sector_id_user_id_key" ON "sector_users"("sector_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "storage_spaces_sector_id_name_key" ON "storage_spaces"("sector_id", "name");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_storage_space_id_fkey" FOREIGN KEY ("storage_space_id") REFERENCES "storage_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_storage_space_id_fkey" FOREIGN KEY ("storage_space_id") REFERENCES "storage_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sector_users" ADD CONSTRAINT "sector_users_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sector_users" ADD CONSTRAINT "sector_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_spaces" ADD CONSTRAINT "storage_spaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_spaces" ADD CONSTRAINT "storage_spaces_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
