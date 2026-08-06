export const roleNames = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATOR",
  "VIEWER",
] as const;
export type RoleName = (typeof roleNames)[number];

export const permissions = [
  "dashboard.read",
  "organization.read",
  "organization.manage",
  "user.read",
  "user.manage",
  "document.read",
  "document.manage",
  "backup.read",
  "backup.manage",
  "integration.manage",
  "audit.read",
] as const;
export type Permission = (typeof permissions)[number];

export interface TenantSession {
  userId: string;
  organizationId: string | null;
  role: RoleName | null;
  permissions: Permission[];
}

export const sectorRoles = [
  "ADMIN",
  "EDITOR",
  "VIEWER_DOWNLOAD",
  "VIEWER_ONLY",
  "NO_ACCESS",
] as const;
export type SectorRole = (typeof sectorRoles)[number];

