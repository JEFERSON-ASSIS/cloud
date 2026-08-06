import { auth } from "@/auth";
import { AuthorizationError, assertPermission } from "@i7ai/security";
import type { Permission, TenantSession } from "@i7ai/types";

export async function requireTenant(
  permission: Permission,
): Promise<TenantSession> {
  const session = await auth();
  if (!session?.user?.id)
    throw new AuthorizationError("Sessão inválida ou expirada.");
  const tenant = {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
    permissions: session.user.permissions,
  };
  assertPermission(tenant, permission);
  if (!tenant.organizationId && tenant.role !== "SUPER_ADMIN")
    throw new AuthorizationError("Selecione uma empresa.");
  return tenant;
}
