-- AlterTable
ALTER TABLE "backup_sources" ADD COLUMN "sector_id" UUID;

-- AlterTable
ALTER TABLE "backup_schedules" ADD COLUMN "sector_id" UUID;

-- AlterTable
ALTER TABLE "backup_runs" ADD COLUMN "sector_id" UUID;

-- AlterTable
ALTER TABLE "backup_files" ADD COLUMN "sector_id" UUID;

-- CreateIndex
CREATE INDEX "backup_sources_organization_id_sector_id_idx" ON "backup_sources"("organization_id", "sector_id");

-- CreateIndex
CREATE INDEX "backup_schedules_organization_id_sector_id_idx" ON "backup_schedules"("organization_id", "sector_id");

-- CreateIndex
CREATE INDEX "backup_runs_organization_id_sector_id_idx" ON "backup_runs"("organization_id", "sector_id");

-- CreateIndex
CREATE INDEX "backup_files_sector_id_idx" ON "backup_files"("sector_id");

-- AddForeignKey
ALTER TABLE "backup_sources" ADD CONSTRAINT "backup_sources_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_schedules" ADD CONSTRAINT "backup_schedules_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_runs" ADD CONSTRAINT "backup_runs_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_files" ADD CONSTRAINT "backup_files_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
