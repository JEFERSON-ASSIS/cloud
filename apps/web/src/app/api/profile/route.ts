import argon2 from "argon2";
import { prisma } from "@i7ai/database";
import { auth } from "@/auth";
import { updateProfileSchema } from "@/server/profile";
import { writeAudit } from "@/server/audit";

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sessão inválida ou expirada.");
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, status: "ACTIVE", deletedAt: null },
  });
  if (!user) throw new Error("Usuário bloqueado, removido ou inativo.");
  return { session, user };
}

export async function GET() {
  try {
    const { user } = await currentUser();
    return Response.json({
      id: user.id,
      name: user.name,
      email: user.email,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar perfil." },
      { status: 401 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { session, user } = await currentUser();
    const parsed = updateProfileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Dados do perfil inválidos." },
        { status: 400 },
      );
    }
    const data = parsed.data;
    const wantsPasswordChange = Boolean(
      data.currentPassword || data.newPassword || data.confirmPassword,
    );
    let passwordHash: string | undefined;
    if (wantsPasswordChange) {
      const currentMatches = await argon2.verify(
        user.passwordHash,
        data.currentPassword,
      );
      if (!currentMatches) throw new Error("A senha atual está incorreta.");
      if (await argon2.verify(user.passwordHash, data.newPassword)) {
        throw new Error("A nova senha deve ser diferente da senha atual.");
      }
      passwordHash = await argon2.hash(data.newPassword, { type: argon2.argon2id });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({
        where: { id: user.id },
        data: { name: data.name, ...(passwordHash ? { passwordHash } : {}) },
        select: { id: true, name: true, email: true },
      });
      if (passwordHash) {
        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      return saved;
    });
    await writeAudit({
      organizationId: session.user.organizationId,
      userId: user.id,
      action: wantsPasswordChange ? "PASSWORD_CHANGE" : "PROFILE_UPDATE",
      resourceType: "User",
      resourceId: user.id,
      metadata: { nameChanged: user.name !== updated.name },
    });
    return Response.json({ ...updated, passwordChanged: wantsPasswordChange });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar perfil." },
      { status: 400 },
    );
  }
}
