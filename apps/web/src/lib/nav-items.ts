import type { Permission } from "@i7ai/types";

export const menuKeys = [
  "dashboard",
  "secretarias",
  "arquivos",
  "pastas",
  "backups",
  "agendamentos",
  "servidores",
  "integracoes",
  "usuarios",
  "empresas",
  "auditoria",
  "logs",
  "configuracoes",
  "permissoes",
] as const;

export type MenuKey = (typeof menuKeys)[number];

export type NavItemDefinition = {
  key: MenuKey;
  label: string;
  href: string;
  permission?: Permission;
  superAdminOnly?: boolean;
};

/** Catálogo único do menu (sem ícones — estes ficam no AppShell). */
export const navItemDefinitions: NavItemDefinition[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", permission: "dashboard.read" },
  { key: "secretarias", label: "Secretarias", href: "/secretarias", permission: "organization.read" },
  { key: "arquivos", label: "Arquivos", href: "/arquivos", permission: "document.read" },
  { key: "pastas", label: "Pastas", href: "/pastas", permission: "document.read" },
  { key: "backups", label: "Backups", href: "/backups", permission: "backup.read" },
  { key: "agendamentos", label: "Agendamentos", href: "/agendamentos", permission: "backup.read" },
  { key: "servidores", label: "Servidores", href: "/servidores", permission: "integration.manage" },
  { key: "integracoes", label: "Integrações", href: "/integracoes", permission: "integration.manage" },
  { key: "usuarios", label: "Usuários", href: "/usuarios", permission: "user.read" },
  { key: "empresas", label: "Empresas", href: "/empresas", permission: "organization.manage", superAdminOnly: true },
  { key: "auditoria", label: "Auditoria", href: "/auditoria", permission: "audit.read" },
  { key: "logs", label: "Logs", href: "/logs", permission: "audit.read" },
  { key: "configuracoes", label: "Configurações", href: "/configuracoes", permission: "organization.read" },
  { key: "permissoes", label: "Permissões", href: "/permissoes", superAdminOnly: true },
];

export const editableRoleNames = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"] as const;

export function isMenuKey(value: string): value is MenuKey {
  return (menuKeys as readonly string[]).includes(value);
}

/** Itens que um perfil comum pode receber (exclui superAdminOnly). */
export function assignableMenuKeys(): MenuKey[] {
  return navItemDefinitions
    .filter((item) => !item.superAdminOnly)
    .map((item) => item.key);
}

/** Fallback alinhado às permissões de API quando ainda não há RoleMenuItem. */
export function menuKeysFromPermissions(permissions: Permission[]): MenuKey[] {
  return navItemDefinitions
    .filter((item) => {
      if (item.superAdminOnly) return false;
      if (!item.permission) return true;
      return permissions.includes(item.permission);
    })
    .map((item) => item.key);
}
