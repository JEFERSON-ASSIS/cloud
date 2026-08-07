import type { Permission, TenantSession } from "@i7ai/types";

/**
 * Pode mutar documentos/pastas (upload, pasta, mover, etc.).
 * Quem tem acesso a Arquivos (document.read ou document.manage) também pode fazer upload;
 * o papel na secretaria (EDITOR) deixa de bloquear esses perfis.
 */
export function canManageDocuments(tenant: Pick<TenantSession, "role" | "permissions">) {
  return (
    tenant.role === "SUPER_ADMIN" ||
    tenant.role === "ADMIN" ||
    tenant.permissions.includes("document.manage" as Permission) ||
    tenant.permissions.includes("document.read" as Permission)
  );
}

/** Papel padrão na secretaria ao vincular usuário, conforme perfil da empresa. */
export function defaultSectorRoleForOrgRole(orgRoleName: string): "EDITOR" | "VIEWER_DOWNLOAD" {
  if (orgRoleName === "VIEWER") return "VIEWER_DOWNLOAD";
  return "EDITOR";
}
