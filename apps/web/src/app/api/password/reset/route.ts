import { createHash } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "@i7ai/database";
import { z } from "zod";
const schema = z.object({
  token: z.string().min(32),
  password: z.string().min(12).max(200),
});
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  const tokenHash = createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date())
    return Response.json(
      { error: "Link inválido ou expirado." },
      { status: 400 },
    );
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await argon2.hash(parsed.data.password, {
          type: argon2.argon2id,
        }),
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
  return Response.json({ message: "Senha alterada com sucesso." });
}
