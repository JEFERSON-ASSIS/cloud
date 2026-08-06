import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany();
  console.info(`Encontradas ${orgs.length} organizações.`);

  for (const org of orgs) {
    console.info(`Processando organização: ${org.name} (${org.id})`);

    // 1. Criar ou buscar setor "Geral"
    const sectorName = "Geral";
    const sector = await prisma.sector.upsert({
      where: {
        organizationId_name: {
          organizationId: org.id,
          name: sectorName,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        name: sectorName,
        quotaLimit: 10737418240, // 10 GB
      },
    });
    console.info(`Setor "${sectorName}" ID: ${sector.id}`);

    // 2. Criar ou buscar área de armazenamento "Geral"
    const spaceName = "Geral";
    const space = await prisma.storageSpace.upsert({
      where: {
        sectorId_name: {
          sectorId: sector.id,
          name: spaceName,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        sectorId: sector.id,
        name: spaceName,
      },
    });
    console.info(`Área de Armazenamento "${spaceName}" ID: ${space.id}`);

    // 3. Vincular todos os usuários da organização à nova secretaria como ADMIN
    const orgUsers = await prisma.organizationUser.findMany({
      where: { organizationId: org.id },
    });

    for (const orgUser of orgUsers) {
      await prisma.sectorUser.upsert({
        where: {
          sectorId_userId: {
            sectorId: sector.id,
            userId: orgUser.userId,
          },
        },
        update: {},
        create: {
          sectorId: sector.id,
          userId: orgUser.userId,
          role: "ADMIN",
        },
      });
    }
    console.info(`Vinculados ${orgUsers.length} usuários ao setor Geral como ADMIN.`);

    // 4. Atualizar todas as pastas da organização sem setor definido
    const updatedFolders = await prisma.folder.updateMany({
      where: {
        organizationId: org.id,
        sectorId: null,
      },
      data: {
        sectorId: sector.id,
        storageSpaceId: space.id,
      },
    });
    console.info(`Atualizadas ${updatedFolders.count} pastas.`);

    // 5. Atualizar todos os documentos da organização sem setor definido
    const updatedDocs = await prisma.document.updateMany({
      where: {
        organizationId: org.id,
        sectorId: null,
      },
      data: {
        sectorId: sector.id,
        storageSpaceId: space.id,
      },
    });
    console.info(`Atualizados ${updatedDocs.count} documentos.`);
  }
}

main()
  .then(() => console.info("Migração de dados executada com sucesso!"))
  .catch((err) => console.error("Erro na migração de dados:", err))
  .finally(() => prisma.$disconnect());
