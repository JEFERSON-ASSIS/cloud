import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@i7ai/database";
import { z } from "zod";
const schema = z.object({ email: z.email().transform((v) => v.toLowerCase()) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "E-mail inválido." }, { status: 400 });
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (user?.status === "ACTIVE") {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    if (process.env.NODE_ENV === "development")
      console.info(
        JSON.stringify({
          event: "password_reset_requested",
          userId: user.id,
          resetUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/redefinir-senha?token=${token}`,
        }),
      );
  }
  return Response.json({
    message: "Se o e-mail estiver cadastrado, você receberá as instruções.",
  });
}
