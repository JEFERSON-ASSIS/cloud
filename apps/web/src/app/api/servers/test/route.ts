import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { decryptSecret } from "@/server/encryption";
import { testSshConnection } from "@i7ai/backup-core";
import { assertSafeOutboundHost } from "@i7ai/security";
import { z } from "zod";

const testSchema = z.object({
  serverId: z.string().uuid().optional(),
  host: z.string().optional(),
  port: z.number().int().default(22),
  username: z.string().optional(),
  authenticationType: z.enum(["PASSWORD", "KEY"]).optional(),
  password: z.string().nullable().optional(),
  privateKey: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = await requireTenantOrganization(
      "backup.manage",
      request,
      typeof body?.organizationId === "string" ? body.organizationId : null,
    );

    const result = testSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || result.error.message }, { status: 400 });
    }

    let host = "";
    let port = 22;
    let username = "";
    let password: string | null = null;
    let privateKey: string | null = null;

    if (result.data.serverId) {
      const server = await prisma.server.findFirstOrThrow({
        where: { id: result.data.serverId, organizationId, deletedAt: null },
      });
      host = server.host;
      port = server.port;
      username = server.username;
      password = server.encryptedPassword ? decryptSecret(server.encryptedPassword) : null;
      privateKey = server.encryptedPrivateKey ? decryptSecret(server.encryptedPrivateKey) : null;
    } else {
      if (!result.data.host || !result.data.username) {
        return NextResponse.json({ error: "Host e usuário são obrigatórios para testar novo servidor." }, { status: 400 });
      }
      host = result.data.host;
      port = result.data.port;
      username = result.data.username;
      password = result.data.password || null;
      privateKey = result.data.privateKey || null;
    }

    try {
      await assertSafeOutboundHost(host, "ssh");
      await testSshConnection({ host, port, username, password, privateKey });
      return NextResponse.json({ success: true });
    } catch (sshError) {
      const msg = sshError instanceof Error ? sshError.message : "Falha na conexão SSH.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
