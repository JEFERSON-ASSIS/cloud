import argon2 from "argon2";
import { prisma } from "@i7ai/database";
import { z } from "zod";
import { requireTenant } from "@/server/tenant";
import { canAssignOrganizationRole, resolveManagedOrganizationId } from "@/server/user-memberships";
import { defaultSectorRoleForOrgRole } from "@/server/document-access";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(200),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
  organizationId: z.string().uuid().optional(),
  sectorIds: z.array(z.string().uuid()).default([]),
});

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("user.read");
    const url = new URL(request.url);
    const paramOrgId = url.searchParams.get("organizationId");

    const whereClause: { organizationId?: string } = {};
    if (tenant.role === "SUPER_ADMIN") {
      if (paramOrgId) {
        whereClause.organizationId = paramOrgId;
      }
    } else {
      whereClause.organizationId = tenant.organizationId!;
    }

    const sectorOrganizationId = paramOrgId ?? (tenant.role === "SUPER_ADMIN" ? null : tenant.organizationId);
    const orgUsers = await prisma.organizationUser.findMany({
      where: whereClause,
      include: {
        organization: { select: { id: true, name: true } },
        role: { select: { name: true } },
        user: {
          include: {
            sectors: {
              ...(sectorOrganizationId ? { where: { sector: { organizationId: sectorOrganizationId } } } : {}),
              include: {
                sector: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    const formatted = orgUsers.map((ou) => ({
      id: ou.user.id,
      name: ou.user.name,
      email: ou.user.email,
      status: ou.user.status,
      lastLoginAt: ou.user.lastLoginAt,
      role: ou.role.name,
      organizationId: ou.organizationId,
      organizationName: ou.organization.name,
      sectors: ou.user.sectors
        .filter((su) => su.sector)
        .map((su) => ({ id: su.sector.id, name: su.sector.name, role: su.role })),
    }));

    return Response.json(formatted);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 403 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant("user.manage");
    const data = createUserSchema.parse(await request.json());

    const targetOrgId = resolveManagedOrganizationId({
      actorRole: tenant.role,
      sessionOrganizationId: tenant.organizationId,
      requestedOrganizationId: data.organizationId,
    });

    if (!targetOrgId) {
      return Response.json({ error: "Selecione uma empresa ou prefeitura." }, { status: 400 });
    }
    if (!canAssignOrganizationRole(tenant.role, data.role)) {
      return Response.json({ error: "Apenas um Super Administrador pode conceder esse perfil." }, { status: 403 });
    }

    const organization = await prisma.organization.findFirst({
      where: { id: targetOrgId, deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    });
    if (!organization) {
      return Response.json({ error: "Empresa ou prefeitura inválida." }, { status: 400 });
    }
    const sectors = await prisma.sector.findMany({
      where: { id: { in: data.sectorIds }, organizationId: targetOrgId, deletedAt: null },
      select: { id: true },
    });
    if (sectors.length !== data.sectorIds.length) {
      return Response.json({ error: "Uma ou mais secretarias não pertencem à empresa selecionada." }, { status: 400 });
    }

    const role = await prisma.role.findUniqueOrThrow({
      where: { name: data.role },
    });

    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: data.email } });
      const created = existing ?? await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash: await argon2.hash(data.password, { type: argon2.argon2id }),
        },
      });

      await tx.organizationUser.upsert({
        where: { organizationId_userId: { organizationId: targetOrgId, userId: created.id } },
        update: { roleId: role.id },
        create: {
          organizationId: targetOrgId,
          userId: created.id,
          roleId: role.id,
        },
      });

      const sectorRole = defaultSectorRoleForOrgRole(data.role);
      for (const sector of sectors) await tx.sectorUser.upsert({
        where: { sectorId_userId: { sectorId: sector.id, userId: created.id } },
        update: { role: sectorRole },
        create: {
          sectorId: sector.id,
          userId: created.id,
          role: sectorRole,
        },
      });

      return created;
    });

    return Response.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        role: role.name,
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 }
    );
  }
}
