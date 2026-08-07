import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@i7ai.com.br";
  const password = "SuaSenhaForteAqui123!";
  const passwordHash = await argon2.hash(password);

  // Garantir a Organização Padrão
  let org = await prisma.organization.findFirst({
    where: { name: "Organization" },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Organization",
        slug: "organization",
        status: "ACTIVE",
      },
    });
  }

  // Garantir Role ADMIN
  let role = await prisma.role.findFirst({
    where: { name: "ADMIN" },
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        name: "ADMIN",
        description: "Administrador do Sistema",
        isSystem: true,
      },
    });
  }

  // Upsert do usuário admin@i7ai.com.br
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      status: "ACTIVE",
      name: "Administrador i7AI",
    },
    create: {
      email,
      name: "Administrador i7AI",
      passwordHash,
      status: "ACTIVE",
    },
  });

  // Vincular à Organização com papel ADMIN
  await prisma.userOrganizationRole.upsert({
    where: {
      userId_organizationId_roleId: {
        userId: user.id,
        organizationId: org.id,
        roleId: role.id,
      },
    },
    update: {
      isDefault: true,
    },
    create: {
      userId: user.id,
      organizationId: org.id,
      roleId: role.id,
      isDefault: true,
    },
  });

  console.log("SUCESSO: Usuario admin@i7ai.com.br cadastrado/atualizado com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
