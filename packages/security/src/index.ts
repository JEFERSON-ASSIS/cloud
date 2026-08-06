import type { Permission, TenantSession } from "@i7ai/types";

export class AuthorizationError extends Error {
  readonly statusCode = 403;
  constructor(message = "Você não tem permissão para realizar esta ação.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function assertTenantAccess(
  session: TenantSession,
  organizationId: string,
): void {
  if (
    session.role !== "SUPER_ADMIN" &&
    session.organizationId !== organizationId
  ) {
    throw new AuthorizationError("Acesso negado à empresa solicitada.");
  }
}

export function assertPermission(
  session: TenantSession,
  permission: Permission,
): void {
  if (
    session.role !== "SUPER_ADMIN" &&
    !session.permissions.includes(permission)
  )
    throw new AuthorizationError();
}

export function authorizeTenant(
  session: TenantSession,
  organizationId: string,
  permission: Permission,
): void {
  assertTenantAccess(session, organizationId);
  assertPermission(session, permission);
}

import type { SectorRole } from "@i7ai/types";

const sectorRoleWeights: Record<SectorRole, number> = {
  ADMIN: 4,
  EDITOR: 3,
  VIEWER_DOWNLOAD: 2,
  VIEWER_ONLY: 1,
  NO_ACCESS: 0,
};

export function hasSectorPermission(
  userRole: SectorRole | null | undefined,
  requiredRole: SectorRole,
  isOrgAdminOrSuper = false,
): boolean {
  if (isOrgAdminOrSuper) return true;
  if (!userRole) return false;
  return sectorRoleWeights[userRole] >= sectorRoleWeights[requiredRole];
}

export function assertSectorPermission(
  userRole: SectorRole | null | undefined,
  requiredRole: SectorRole,
  isOrgAdminOrSuper = false,
): void {
  if (!hasSectorPermission(userRole, requiredRole, isOrgAdminOrSuper)) {
    throw new AuthorizationError("Você não tem permissão para acessar esta secretaria.");
  }
}

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey(): Buffer {
  const value = process.env.ENCRYPTION_KEY;
  if (!value) throw new Error("ENCRYPTION_KEY não configurada.");
  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // fall through to hash
  }
  return createHash("sha256").update(value, "utf8").digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string): string {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted)
    throw new Error("Segredo criptografado inválido.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
