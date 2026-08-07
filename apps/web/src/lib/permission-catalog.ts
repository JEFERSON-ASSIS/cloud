import { permissions, type Permission } from "@i7ai/types";

export type PermissionCatalogItem = {
  key: Permission;
  label: string;
  description: string;
  group: string;
};

/** Catálogo de permissões de API (RolePermission), com rótulos para a UI. */
export const permissionCatalog: PermissionCatalogItem[] = [
  {
    key: "dashboard.read",
    label: "Ver dashboard",
    description: "Acessar métricas e visão geral.",
    group: "Dashboard",
  },
  {
    key: "organization.read",
    label: "Ver organização",
    description: "Consultar empresa, secretarias e configurações.",
    group: "Organização",
  },
  {
    key: "organization.manage",
    label: "Gerenciar organização",
    description: "Alterar dados da empresa e limites.",
    group: "Organização",
  },
  {
    key: "user.read",
    label: "Ver usuários",
    description: "Listar usuários e vínculos.",
    group: "Usuários",
  },
  {
    key: "user.manage",
    label: "Gerenciar usuários",
    description: "Criar, editar e desativar usuários.",
    group: "Usuários",
  },
  {
    key: "document.read",
    label: "Ver arquivos",
    description: "Listar e abrir documentos e pastas.",
    group: "Documentos",
  },
  {
    key: "document.manage",
    label: "Gerenciar arquivos",
    description: "Upload, criar pasta, mover, renomear e excluir.",
    group: "Documentos",
  },
  {
    key: "backup.read",
    label: "Ver backups",
    description: "Consultar fontes, execuções e agendamentos.",
    group: "Backups",
  },
  {
    key: "backup.manage",
    label: "Gerenciar backups",
    description: "Criar, editar e disparar backups.",
    group: "Backups",
  },
  {
    key: "integration.manage",
    label: "Gerenciar integrações",
    description: "Servidores, armazenamento e conexões.",
    group: "Integrações",
  },
  {
    key: "audit.read",
    label: "Ver auditoria",
    description: "Consultar logs e trilha de auditoria.",
    group: "Auditoria",
  },
];

export function isPermissionKey(value: string): value is Permission {
  return (permissions as readonly string[]).includes(value);
}

export function assignablePermissionKeys(): Permission[] {
  return [...permissions];
}
