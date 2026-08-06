import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("document.read");
    const organizationId = tenant.organizationId!;
    const url = new URL(request.url);
    const sectorId = url.searchParams.get("sectorId");

    if (!sectorId) {
      return Response.json({ error: "Setor (sectorId) é obrigatório." }, { status: 400 });
    }

    const spaces = await prisma.storageSpace.findMany({
      where: {
        organizationId,
        sectorId,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });

    return Response.json(spaces);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao listar áreas de armazenamento." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant("document.manage");
    const organizationId = tenant.organizationId!;

    const body = (await request.json()) as {
      sectorId?: string;
      name?: string;
    };

    const sectorId = body.sectorId;
    const name = body.name?.trim();

    if (!sectorId || !name) {
      return Response.json({ error: "Setor e Nome são obrigatórios." }, { status: 400 });
    }

    // Validar se o setor pertence à organização
    await prisma.sector.findFirstOrThrow({
      where: { id: sectorId, organizationId, deletedAt: null },
    });

    const space = await prisma.storageSpace.create({
      data: {
        organizationId,
        sectorId,
        name,
      },
    });

    return Response.json(space, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao criar área de armazenamento." },
      { status: 400 }
    );
  }
}
