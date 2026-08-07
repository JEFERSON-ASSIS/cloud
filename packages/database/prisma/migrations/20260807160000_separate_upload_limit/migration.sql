ALTER TABLE "organizations"
ADD COLUMN "max_upload_file_size" BIGINT NOT NULL DEFAULT 104857600;

-- Repara somente quotas comprovadamente menores que a soma já alocada às secretarias.
UPDATE "organizations" AS organization
SET "storage_limit" = allocated.total_quota
FROM (
  SELECT "organization_id", SUM("quota_limit") AS total_quota
  FROM "sectors"
  WHERE "deleted_at" IS NULL
  GROUP BY "organization_id"
) AS allocated
WHERE organization."id" = allocated."organization_id"
  AND organization."storage_limit" < allocated.total_quota;
