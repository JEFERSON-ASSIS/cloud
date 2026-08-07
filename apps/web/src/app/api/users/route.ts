import argon2 from "argon2";
import { prisma } from "@i7ai/database";
import { z } from "zod";
import { requireTenant } from "@/server/tenant";
const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(200),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
});
export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("user.read");
    const url = new URL(request.url);
    const paramOrgId = url.searchParams.get("organizationId");
    const organizationId =
      tenant.role === "SUPER_ADMIN" && paramOrgId
        ? paramOrgId
        : tenant.organizationId!;

    const users = await prisma.organizationUser.findMany({
      where: { organizationId },
      include: { user: true, role: true },
      orderBy: { user: { name: "asc" } },
    });
    return Response.json(
      users.map(({ user, role }) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        role: role.name,
      })),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const tenant = await requireTenant("user.manage");
    const data = createUserSchema.parse(await request.json());
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
          organizationId: tenant.organizationId!,
          userId: created.id,
          roleId: role.id,
        },
      });
      return created;
    });
    return Response.json(
      { id: user.id, name: user.name, email: user.email },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        { error: "Dados inválidos.", fields: error.flatten().fieldErrors },
        { status: 400 },
      );
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 403 },
    );
  }
}
