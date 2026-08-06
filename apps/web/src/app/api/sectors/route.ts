import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function GET() {
  try {
    const tenant = await requireTenant("document.read");
    const organizationId = tenant.organizationId!;

    const sectors = await prisma.sector.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            users: true,
            storageSpaces: true,
            documents: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return Response.json(
      sectors.map((s) => ({
        ...s,
        quotaLimit: s.quotaLimit.toString(),
      }))
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao listar secretarias." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant("user.manage");
    const organizationId = tenant.organizationId!;

    const body = (await request.json()) as {
      name?: string;
      quotaLimit?: number | string;
    };

    const name = body.name?.trim();
    if (!name) {
      return Response.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    const quotaLimit = body.quotaLimit ? BigInt(body.quotaLimit) : BigInt(1073741824); // Default 1GB

    // Validar se a soma das quotas excede o limite da organização
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    const activeSectors = await prisma.sector.findMany({
      where: { organizationId, deletedAt: null },
    });

    const currentTotalQuota = activeSectors.reduce((sum, s) => sum + s.quotaLimit, BigInt(0));
    if (currentTotalQuota + quotaLimit > organization.storageLimit) {
      return Response.json(
        {
          error: `A soma das quotas das secretarias excede o limite contratado da organização (${(
            Number(organization.storageLimit) /
            1024 /
            1024 /
            1024
          ).toFixed(1)} GB).`,
        },
        { status: 400 }
      );
    }

    const sector = await prisma.sector.create({
      data: {
        organizationId,
        name,
        quotaLimit,
      },
    });

    return Response.json(
      {
        ...sector,
        quotaLimit: sector.quotaLimit.toString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao criar secretaria." },
      { status: 400 }
    );
  }
}
