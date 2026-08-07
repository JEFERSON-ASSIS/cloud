import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import type { SectorRole } from "@i7ai/types";
import { z } from "zod";

const memberSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER_DOWNLOAD", "VIEWER_ONLY", "NO_ACCESS"]).default("VIEWER_DOWNLOAD"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.read");
    const { id } = await params;

    // Validar se o setor existe (Super Admin acessa qualquer setor)
    await prisma.sector.findFirstOrThrow({
      where: tenant.role === "SUPER_ADMIN"
        ? { id, deletedAt: null }
        : { id, organizationId: tenant.organizationId!, deletedAt: null },
    });

    const members = await prisma.sectorUser.findMany({
      where: { sectorId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    return Response.json(members);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao listar membros." },
      { status: 400 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.manage");
    const { id } = await params;

    // Validar se o setor existe e obter a sua organizationId
    const sector = await prisma.sector.findFirstOrThrow({
      where: tenant.role === "SUPER_ADMIN"
        ? { id, deletedAt: null }
        : { id, organizationId: tenant.organizationId!, deletedAt: null },
    });
    const organizationId = sector.organizationId;

    const { email, role } = memberSchema.parse(await request.json()) as { email: string; role: SectorRole };

    // Buscar o usuário correspondente
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Se o usuário não for da organização e quem executa for Super Admin, garante o vínculo na organização
    let orgMembership = await prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });

    if (!orgMembership && tenant.role === "SUPER_ADMIN") {
      const viewerRole = await prisma.role.findUnique({ where: { name: "VIEWER" } });
      if (!viewerRole) return Response.json({ error: "O perfil Visualizador não está configurado." }, { status: 500 });
      orgMembership = await prisma.organizationUser.create({
        data: {
          organizationId,
          userId: user.id,
          roleId: viewerRole.id,
        },
      });
    }

    if (!orgMembership) {
      return Response.json(
        { error: "O usuário deve primeiro ser convidado para a organização." },
        { status: 400 }
      );
    }

    // Upsert na tabela sector_users
    const sectorUser = await prisma.sectorUser.upsert({
      where: {
        sectorId_userId: {
          sectorId: id,
          userId: user.id,
        },
      },
      update: { role },
      create: {
        sectorId: id,
        userId: user.id,
        role,
      },
    });

    return Response.json(sectorUser);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao adicionar/atualizar membro." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.manage");
    const { id } = await params;

    // Validar se o setor existe
    await prisma.sector.findFirstOrThrow({
      where: tenant.role === "SUPER_ADMIN"
        ? { id, deletedAt: null }
        : { id, organizationId: tenant.organizationId!, deletedAt: null },
    });

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "ID do usuário é obrigatório." }, { status: 400 });
    }

    // Remover da tabela sector_users
    await prisma.sectorUser.delete({
      where: {
        sectorId_userId: {
          sectorId: id,
          userId,
        },
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao remover membro." },
      { status: 400 }
    );
  }
}
