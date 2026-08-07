export function canSeeGoogleDriveBrand(role?: string | null) {
  return role === "SUPER_ADMIN";
}

export function storageProviderLabel(role?: string | null) {
  return canSeeGoogleDriveBrand(role) ? "Google Drive" : "Armazenamento em nuvem";
}

export function sanitizeStorageText(text: string, role?: string | null): string {
  if (canSeeGoogleDriveBrand(role) || !text) return text;
  return text
    .replace(/Google Drive/gi, "armazenamento em nuvem")
    .replace(/GOOGLE_DRIVE_/g, "STORAGE_")
    .replace(/\bDRIVE\b/g, "STORAGE");
}

export function sanitizeAuditAction(action: string, role?: string | null): string {
  if (canSeeGoogleDriveBrand(role) || !action) return action;
  return action
    .replace(/^GOOGLE_DRIVE_/, "STORAGE_")
    .replace(/_GOOGLE_DRIVE_/g, "_STORAGE_");
}
