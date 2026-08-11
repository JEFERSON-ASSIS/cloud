import {
  prisma,
  type Document,
  type DocumentShare,
  type Folder,
} from "@i7ai/database";
import { AuthorizationError } from "@i7ai/security";
import type { TenantSession } from "@i7ai/types";

const roleWeight = {
  ADMIN: 4,
  EDITOR: 3,
  VIEWER_DOWNLOAD: 2,
  VIEWER_ONLY: 1,
  NO_ACCESS: 0,
};

export function sectorRoleWeight(role: string | null | undefined) {
  return roleWeight[role as keyof typeof roleWeight] ?? 0;
}

export function sharePermissionAllowsDownload(permission: "VIEW" | "DOWNLOAD") {
  return permission === "DOWNLOAD";
}

type ShareAccess = {
  shared: boolean;
  canDownload: boolean;
  shareId?: string;
  targetSectorId?: string;
  rootFolderId?: string;
};

function isPrivileged(tenant: Pick<TenantSession, "role">) {
  return tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN";
}

function recipientWhere(userId: string, privileged: boolean) {
  return privileged
    ? {}
    : {
        OR: [{ targetUserId: null }, { targetUserId: userId }],
      };
}

export async function assertActiveSectorAccess(
  tenant: TenantSession,
  organizationId: string,
  sectorId: string,
) {
  const sector = await prisma.sector.findFirst({
    where: { id: sectorId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!sector) throw new AuthorizationError("Secretaria não encontrada.");
  if (isPrivileged(tenant)) return;

  const membership = await prisma.sectorUser.findUnique({
    where: { sectorId_userId: { sectorId, userId: tenant.userId } },
    select: { role: true },
  });
  if (!membership || sectorRoleWeight(membership.role) < roleWeight.VIEWER_ONLY) {
    throw new AuthorizationError("Acesso negado: você não pertence a esta Secretaria.");
  }
}

export async function folderAncestorIds(
  organizationId: string,
  folderId: string | null,
) {
  const ids: string[] = [];
  let current = folderId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const folder = await prisma.folder.findFirst({
      where: { id: current, organizationId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!folder) break;
    ids.push(folder.id);
    current = folder.parentId;
  }
  return ids;
}

async function targetSectorIdsForUser(
  tenant: TenantSession,
  organizationId: string,
  requestedTargetSectorId?: string,
) {
  if (requestedTargetSectorId) {
    await assertActiveSectorAccess(tenant, organizationId, requestedTargetSectorId);
    return [requestedTargetSectorId];
  }
  const memberships = await prisma.sectorUser.findMany({
    where: {
      userId: tenant.userId,
      sector: { organizationId, deletedAt: null },
      role: { not: "NO_ACCESS" },
    },
    select: { sectorId: true },
  });
  return memberships.map((membership) => membership.sectorId);
}

export async function resolveDocumentAccess(
  tenant: TenantSession,
  document: Pick<Document, "id" | "organizationId" | "sectorId" | "folderId">,
  options?: { download?: boolean; targetSectorId?: string },
): Promise<ShareAccess> {
  if (isPrivileged(tenant)) return { shared: false, canDownload: true };

  if (!document.sectorId) return { shared: false, canDownload: true };
  const sourceMembership = await prisma.sectorUser.findUnique({
    where: {
      sectorId_userId: {
        sectorId: document.sectorId,
        userId: tenant.userId,
      },
    },
    select: { role: true },
  });
  const sourceWeight = sectorRoleWeight(sourceMembership?.role);
  if (sourceWeight >= roleWeight.VIEWER_ONLY) {
    const canDownload = sourceWeight >= roleWeight.VIEWER_DOWNLOAD;
    if (!options?.download || canDownload) {
      return { shared: false, canDownload };
    }
  }

  const targetSectorIds = await targetSectorIdsForUser(
    tenant,
    document.organizationId,
    options?.targetSectorId,
  );
  if (targetSectorIds.length === 0) {
    throw new AuthorizationError("Você não possui acesso a este documento.");
  }
  const ancestorIds = await folderAncestorIds(
    document.organizationId,
    document.folderId,
  );
  const share = await prisma.documentShare.findFirst({
    where: {
      organizationId: document.organizationId,
      targetSectorId: { in: targetSectorIds },
      revokedAt: null,
      ...recipientWhere(tenant.userId, false),
      OR: [
        { documentId: document.id },
        ...(ancestorIds.length > 0 ? [{ folderId: { in: ancestorIds } }] : []),
      ],
    },
    orderBy: { permission: "asc" },
  });
  if (!share) {
    if (sourceWeight >= roleWeight.VIEWER_ONLY && options?.download) {
      throw new AuthorizationError("Você pode visualizar, mas não baixar este documento.");
    }
    throw new AuthorizationError("Você não possui acesso a este documento.");
  }
  const canDownload = sharePermissionAllowsDownload(share.permission);
  if (options?.download && !canDownload) {
    throw new AuthorizationError("Este compartilhamento permite apenas visualização.");
  }
  return {
    shared: true,
    canDownload,
    shareId: share.id,
    targetSectorId: share.targetSectorId,
    ...(share.folderId ? { rootFolderId: share.folderId } : {}),
  };
}

export async function resolveSharedFolderAccess(
  tenant: TenantSession,
  organizationId: string,
  targetSectorId: string,
  folderId: string,
): Promise<DocumentShare> {
  await assertActiveSectorAccess(tenant, organizationId, targetSectorId);
  const ancestorIds = await folderAncestorIds(organizationId, folderId);
  const share = await prisma.documentShare.findFirst({
    where: {
      organizationId,
      targetSectorId,
      folderId: { in: ancestorIds },
      revokedAt: null,
      ...recipientWhere(tenant.userId, isPrivileged(tenant)),
    },
    orderBy: [{ permission: "asc" }, { createdAt: "asc" }],
  });
  if (!share) throw new AuthorizationError("Pasta compartilhada não encontrada.");
  return share;
}

export async function sharedFolderBreadcrumbs(
  organizationId: string,
  folderId: string,
  sharedRootFolderId: string,
) {
  const result: Pick<Folder, "id" | "name">[] = [];
  let current: string | null = folderId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const folder: { id: string; name: string; parentId: string | null } | null =
      await prisma.folder.findFirst({
      where: { id: current, organizationId, deletedAt: null },
      select: { id: true, name: true, parentId: true },
      });
    if (!folder) break;
    result.unshift({ id: folder.id, name: folder.name });
    if (folder.id === sharedRootFolderId) break;
    current = folder.parentId;
  }
  if (result[0]?.id !== sharedRootFolderId) {
    throw new AuthorizationError("Caminho compartilhado inválido.");
  }
  return result;
}

export function shareRecipientFilter(userId: string, privileged: boolean) {
  return recipientWhere(userId, privileged);
}

export function tenantIsPrivileged(tenant: Pick<TenantSession, "role">) {
  return isPrivileged(tenant);
}
