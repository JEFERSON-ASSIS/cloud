import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function GET() {
  try {
    const tenant = await requireTenant("organization.read");
    const organizations =
      tenant.role === "SUPER_ADMIN"
        ? await prisma.organization.findMany({
            where: { deletedAt: null },
            include: {
              _count: { select: { users: true, documents: true, backupRuns: true, sectors: true } },
              documents: { where: { deletedAt: null }, select: { size: true } },
            },
            orderBy: { name: "asc" },
          })
        : await prisma.organization.findMany({
            where: { id: tenant.organizationId!, deletedAt: null },
            include: {
              _count: { select: { users: true, documents: true, backupRuns: true, sectors: true } },
              documents: { where: { deletedAt: null }, select: { size: true } },
            },
          });

    return Response.json(
      organizations.map((item) => ({
        ...item,
        storageLimit: item.storageLimit.toString(),
      }))
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 403 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await requireTenant("organization.manage");
    if (tenant.role !== "SUPER_ADMIN") {
      return Response.json({ error: "Apenas Super Admins podem cadastrar novas Empresas/Prefeituras." }, { status: 403 });
    }

    const body = await req.json();
    const { name, document, storageLimitGB } = body;

    if (!name || typeof name !== "string") {
      return Response.json({ error: "Nome da Empresa/Prefeitura é obrigatório." }, { status: 400 });
    }

    const limitBytes = BigInt(storageLimitGB || 100) * BigInt(1073741824); // GB para Bytes
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `org-${Date.now()}`;

    const newOrg = await prisma.organization.create({
      data: {
        name,
        slug,
        document: document || null,
        storageLimit: limitBytes,
        status: "ACTIVE",
      },
    });

    return Response.json({
      ...newOrg,
      storageLimit: newOrg.storageLimit.toString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao cadastrar organização." },
      { status: 500 }
    );
  }
}
