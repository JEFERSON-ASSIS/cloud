import argon2 from "argon2";
import { prisma } from "@i7ai/database";
import { z } from "zod";
import { requireTenant } from "@/server/tenant";
import { canAssignOrganizationRole, resolveManagedOrganizationId, shouldDeactivateUser } from "@/server/user-memberships";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().transform((v) => v.toLowerCase()).optional(),
  password: z.string().min(12).max(200).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  organizationIds: z.array(z.string().uuid()).optional(),
  sectorIds: z.array(z.string().uuid()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.read");
    const { id } = await params;
    const memberships = await prisma.organizationUser.findMany({
      where: {
        userId: id,
        ...(tenant.role === "SUPER_ADMIN" ? {} : { organizationId: tenant.organizationId! }),
      },
      include: { organization: { select: { id: true, name: true } }, role: { select: { name: true } } },
    });
    if (!memberships.length) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    const organizationIds = memberships.map((item) => item.organizationId);
    const sectors = await prisma.sectorUser.findMany({
      where: { userId: id, sector: { organizationId: { in: organizationIds }, deletedAt: null } },
      include: { sector: { select: { id: true, name: true, organizationId: true } } },
    });
    return Response.json({
      organizationIds,
      memberships: memberships.map((item) => ({ organizationId: item.organizationId, organizationName: item.organization.name, role: item.role.name })),
      sectorIds: sectors.map((item) => item.sectorId),
      sectors: sectors.map((item) => item.sector),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 403 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.manage");
    const { id } = await params;
    const data = updateSchema.parse(await request.json());

    if (data.role && !canAssignOrganizationRole(tenant.role, data.role)) {
      return Response.json({ error: "Apenas um Super Administrador pode conceder esse perfil." }, { status: 403 });
    }
    const targetOrganizationIds = tenant.role === "SUPER_ADMIN"
      ? (data.organizationIds ?? [])
      : [tenant.organizationId!];
    if (tenant.role === "SUPER_ADMIN" && data.organizationIds && !targetOrganizationIds.length) {
      return Response.json({ error: "O usuário deve permanecer vinculado a pelo menos uma empresa." }, { status: 400 });
    }

    // Check the user belongs to an organization the actor can manage.
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: id, ...(tenant.role === "SUPER_ADMIN" ? {} : { organizationId: tenant.organizationId! }) },
    });
    if (!orgUser) {
      return Response.json({ error: "Usuário não encontrado nesta organização." }, { status: 404 });
    }

    const membershipCount = await prisma.organizationUser.count({ where: { userId: id } });
    if (tenant.role !== "SUPER_ADMIN" && membershipCount > 1 && (data.name || data.email || data.password || data.status)) {
      return Response.json({ error: "A identidade deste usuário é compartilhada com outra empresa e só pode ser alterada por um Super Administrador." }, { status: 403 });
    }

    const requestedSectorIds = data.sectorIds ?? [];
    const validSectors = await prisma.sector.findMany({
      where: { id: { in: requestedSectorIds }, organizationId: { in: targetOrganizationIds }, deletedAt: null },
      select: { id: true },
    });
    if (validSectors.length !== requestedSectorIds.length) {
      return Response.json({ error: "Uma ou mais secretarias não pertencem às empresas selecionadas." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.status) updateData.status = data.status;
    if (data.password) {
      updateData.passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: updateData });
      if (data.role) {
        const role = await tx.role.findUniqueOrThrow({ where: { name: data.role } });
        for (const organizationId of targetOrganizationIds) await tx.organizationUser.upsert({
          where: { organizationId_userId: { organizationId, userId: id } },
          update: { roleId: role.id },
          create: { organizationId, userId: id, roleId: role.id },
        });
      }
      if (tenant.role === "SUPER_ADMIN" && data.organizationIds) {
        await tx.sectorUser.deleteMany({
          where: { userId: id, sector: { organizationId: { notIn: targetOrganizationIds } } },
        });
        await tx.organizationUser.deleteMany({ where: { userId: id, organizationId: { notIn: targetOrganizationIds } } });
      }
      if (data.sectorIds) {
        await tx.sectorUser.deleteMany({
          where: { userId: id, sector: { organizationId: { in: targetOrganizationIds } }, sectorId: { notIn: requestedSectorIds } },
        });
        for (const sector of validSectors) await tx.sectorUser.upsert({
          where: { sectorId_userId: { sectorId: sector.id, userId: id } },
          update: {},
          create: { sectorId: sector.id, userId: id, role: "VIEWER_DOWNLOAD" },
        });
      }
      return updated;
    });

    return Response.json({ id: user.id, name: user.name, email: user.email, status: user.status });
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json({ error: "Dados inválidos.", fields: error.flatten().fieldErrors }, { status: 400 });
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.manage");
    const { id } = await params;

    const url = new URL(_request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId");
    const organizationId = resolveManagedOrganizationId({
      actorRole: tenant.role,
      sessionOrganizationId: tenant.organizationId,
      requestedOrganizationId,
    });
    if (!organizationId) return Response.json({ error: "Selecione uma empresa ou prefeitura." }, { status: 400 });
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: id, organizationId },
    });
    if (!orgUser) {
      return Response.json({ error: "Usuário não encontrado nesta organização." }, { status: 404 });
    }

    // Remove from org then soft-delete the user account
    await prisma.$transaction(async (tx) => {
      const organizationSectorIds = await tx.sector.findMany({ where: { organizationId }, select: { id: true } });
      await tx.sectorUser.deleteMany({ where: { userId: id, sectorId: { in: organizationSectorIds.map((sector) => sector.id) } } });
      await tx.organizationUser.delete({
        where: { organizationId_userId: { organizationId, userId: id } },
      });
      const remaining = await tx.organizationUser.count({ where: { userId: id } });
      if (shouldDeactivateUser(remaining)) await tx.user.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 }
    );
  }
}
