import argon2 from "argon2";
import { prisma } from "@i7ai/database";
import { z } from "zod";
import { requireTenant } from "@/server/tenant";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(200),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
  organizationId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("user.read");
    const url = new URL(request.url);
    const paramOrgId = url.searchParams.get("organizationId");

    const whereClause: any = {};
    if (tenant.role === "SUPER_ADMIN") {
      if (paramOrgId) {
        whereClause.organizationId = paramOrgId;
      }
    } else {
      whereClause.organizationId = tenant.organizationId!;
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: whereClause,
      include: {
        organization: { select: { id: true, name: true } },
        role: { select: { name: true } },
        user: {
          include: {
            sectors: {
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

    const targetOrgId =
      tenant.role === "SUPER_ADMIN" && data.organizationId
        ? data.organizationId
        : tenant.organizationId!;

    const role = await prisma.role.findUniqueOrThrow({
      where: { name: data.role },
    });

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash: await argon2.hash(data.password, {
            type: argon2.argon2id,
          }),
        },
      });

      await tx.organizationUser.create({
        data: {
          organizationId: targetOrgId,
          userId: created.id,
          roleId: role.id,
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
