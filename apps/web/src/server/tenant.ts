import { auth } from "@/auth";
import { AuthorizationError, assertPermission } from "@i7ai/security";
import type { Permission, TenantSession } from "@i7ai/types";
import { prisma } from "@i7ai/database";
import { resolveManagedOrganizationId } from "@/server/user-memberships";
import { ACTIVE_ORG_HEADER } from "@/lib/tenant-constants";

export { ACTIVE_ORG_HEADER };

export async function requireTenant(
  permission: Permission,
): Promise<TenantSession> {
  const session = await auth();
  if (!session?.user?.id)
    throw new AuthorizationError("Sessão inválida ou expirada.");
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new AuthorizationError("Usuário bloqueado, removido ou inativo.");

  const membership = session.user.organizationId
    ? await prisma.organizationUser.findFirst({
        where: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          organization: { status: "ACTIVE", deletedAt: null },
        },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      })
    : null;
  if (!membership) throw new AuthorizationError("Vínculo empresarial removido, suspenso ou inválido.");

  const tenant: TenantSession = {
    userId: session.user.id,
    organizationId: membership.organizationId,
    role: membership.role.name as TenantSession["role"],
    permissions: membership.role.permissions.map((item) => item.permission.key as Permission),
  };
  assertPermission(tenant, permission);
  if (!tenant.organizationId && tenant.role !== "SUPER_ADMIN")
    throw new AuthorizationError("Selecione uma empresa.");
  return tenant;
}

export function getRequestedOrganizationId(
  request: Request,
  bodyOrganizationId?: string | null,
): string | null {
  const header = request.headers.get(ACTIVE_ORG_HEADER)?.trim();
  if (header) return header;
  const fromQuery = new URL(request.url).searchParams.get("organizationId")?.trim();
  if (fromQuery) return fromQuery;
  if (typeof bodyOrganizationId === "string" && bodyOrganizationId.trim()) {
    return bodyOrganizationId.trim();
  }
  return null;
}

export async function resolveActiveOrganizationId(
  tenant: TenantSession,
  requestedOrganizationId?: string | null,
): Promise<string> {
  const organizationId = resolveManagedOrganizationId({
    actorRole: tenant.role,
    sessionOrganizationId: tenant.organizationId,
    requestedOrganizationId,
  });
  if (!organizationId) {
    throw new AuthorizationError("Selecione uma empresa.");
  }

  if (
    tenant.role === "SUPER_ADMIN" &&
    requestedOrganizationId &&
    requestedOrganizationId !== tenant.organizationId
  ) {
    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!organization) {
      throw new AuthorizationError("Empresa solicitada inexistente, suspensa ou removida.");
    }
  }

  return organizationId;
}

export async function requireTenantOrganization(
  permission: Permission,
  request: Request,
  bodyOrganizationId?: string | null,
): Promise<{ tenant: TenantSession; organizationId: string }> {
  const tenant = await requireTenant(permission);
  const organizationId = await resolveActiveOrganizationId(
    tenant,
    getRequestedOrganizationId(request, bodyOrganizationId),
  );
  return { tenant, organizationId };
}
