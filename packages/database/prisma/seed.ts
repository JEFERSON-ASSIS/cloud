import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const permissionKeys = [
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
];
const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: permissionKeys,
  ADMIN: permissionKeys,
  MANAGER: [
    "dashboard.read",
    "organization.read",
    "user.read",
    "document.read",
    "document.manage",
    "backup.read",
    "backup.manage",
    "audit.read",
  ],
  OPERATOR: [
    "dashboard.read",
    "document.read",
    "document.manage",
    "backup.read",
    "backup.manage",
  ],
  VIEWER: ["dashboard.read", "document.read", "document.manage", "backup.read"],
};

/** Visibilidade inicial do menu por perfil (itens superAdminOnly ficam só para SUPER_ADMIN no AppShell). */
const roleMenuItems: Record<string, string[]> = {
  ADMIN: [
    "dashboard",
    "secretarias",
    "arquivos",
    "pastas",
    "backups",
    "agendamentos",
    "servidores",
    "integracoes",
    "usuarios",
    "auditoria",
    "logs",
    "configuracoes",
  ],
  MANAGER: [
    "dashboard",
    "secretarias",
    "arquivos",
    "pastas",
    "backups",
    "agendamentos",
    "usuarios",
    "auditoria",
    "logs",
    "configuracoes",
  ],
  OPERATOR: ["dashboard", "arquivos", "pastas", "backups", "agendamentos"],
  VIEWER: ["dashboard", "arquivos", "pastas", "backups"],
};

async function main() {
  const permissions = new Map<string, string>();
  for (const key of permissionKeys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    permissions.set(key, permission.id);
  }
  const roles = new Map<string, string>();
  for (const [name, keys] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roles.set(name, role.id);
    await prisma.rolePermission.createMany({
      data: keys.map((key) => ({
        roleId: role.id,
        permissionId: permissions.get(key)!,
      })),
      skipDuplicates: true,
    });
    const menuKeys = roleMenuItems[name] ?? [];
    if (menuKeys.length > 0) {
      await prisma.roleMenuItem.createMany({
        data: menuKeys.map((menuKey) => ({
          roleId: role.id,
          menuKey,
        })),
        skipDuplicates: true,
      });
    }
  }
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    console.info(
      "Papéis e permissões criados. Administrador inicial não criado: defina INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD.",
    );
    return;
  }
  if (password.length < 12)
    throw new Error(
      "INITIAL_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.",
    );
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: process.env.INITIAL_ADMIN_NAME ?? "Administrador" },
    create: {
      email,
      name: process.env.INITIAL_ADMIN_NAME ?? "Administrador",
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
  });
  const slug = process.env.INITIAL_ORGANIZATION_SLUG ?? "minha-empresa";
  const organization = await prisma.organization.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: process.env.INITIAL_ORGANIZATION_NAME ?? "Minha empresa",
      createdById: user.id,
    },
  });
  await prisma.organizationUser.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: { roleId: roles.get("SUPER_ADMIN")!, isDefault: true },
    create: {
      organizationId: organization.id,
      userId: user.id,
      roleId: roles.get("SUPER_ADMIN")!,
      isDefault: true,
    },
  });
}

main().finally(() => prisma.$disconnect());
