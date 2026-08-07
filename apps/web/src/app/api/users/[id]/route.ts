import argon2 from "argon2";
import { prisma } from "@i7ai/database";
import { z } from "zod";
import { requireTenant } from "@/server/tenant";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().transform((v) => v.toLowerCase()).optional(),
  password: z.string().min(12).max(200).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.manage");
    const { id } = await params;
    const data = updateSchema.parse(await request.json());

    // Check the user belongs to the same org
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: id, organizationId: tenant.organizationId! },
    });
    if (!orgUser) {
      return Response.json({ error: "Usuário não encontrado nesta organização." }, { status: 404 });
    }

    // Update user fields
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
        await tx.organizationUser.update({
          where: { organizationId_userId: { organizationId: tenant.organizationId!, userId: id } },
          data: { roleId: role.id },
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

    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: id, organizationId: tenant.organizationId! },
    });
    if (!orgUser) {
      return Response.json({ error: "Usuário não encontrado nesta organização." }, { status: 404 });
    }

    // Remove from org then soft-delete the user account
    await prisma.$transaction(async (tx) => {
      await tx.organizationUser.delete({
        where: { organizationId_userId: { organizationId: tenant.organizationId!, userId: id } },
      });
      await tx.user.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 }
    );
  }
}
