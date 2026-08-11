export function buildScopedFoldersUrl(
  organizationId: string,
  sectorId: string,
) {
  if (!sectorId) return null;

  const params = new URLSearchParams({
    allFolders: "1",
    sectorId,
  });
  if (organizationId) params.set("organizationId", organizationId);

  return `/api/files?${params.toString()}`;
}
