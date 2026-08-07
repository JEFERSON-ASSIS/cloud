import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { encryptSecret } from "@/server/encryption";
import { writeAudit } from "@/server/audit";
import { z } from "zod";

const createServerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  host: z.string().min(1, "Host é obrigatório"),
  port: z.number().int().default(22),
  username: z.string().min(1, "Usuário é obrigatório"),
  authenticationType: z.enum(["PASSWORD", "KEY"]),
  password: z.string().nullable().optional(),
  privateKey: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("backup.read");
    const url = new URL(request.url);
    const paramOrgId = url.searchParams.get("organizationId");
    const organizationId =
      tenant.role === "SUPER_ADMIN" && paramOrgId
        ? paramOrgId
        : tenant.organizationId!;

    const servers = await prisma.server.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    // Remove credenciais criptografadas antes de enviar para a interface
    const sanitized = servers.map((s) => ({
      id: s.id,
      name: s.name,
      host: s.host,
      port: s.port,
      username: s.username,
      authenticationType: s.authenticationType,
      status: s.status,
      createdAt: s.createdAt,
    }));

    return NextResponse.json(sanitized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant("backup.manage");
    const organizationId = tenant.organizationId!;

    const body = await request.json();
    const result = createServerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || result.error.message }, { status: 400 });
    }

    const { name, host, port, username, authenticationType, password, privateKey } = result.data;

    // Verificar unicidade por nome
    const exists = await prisma.server.findFirst({
      where: { organizationId, name, deletedAt: null },
    });
    if (exists) {
      return NextResponse.json({ error: "Já existe um servidor com este nome nesta empresa." }, { status: 400 });
    }

    const encryptedPassword = password ? encryptSecret(password) : null;
    const encryptedPrivateKey = privateKey ? encryptSecret(privateKey) : null;

    const server = await prisma.server.create({
      data: {
        organizationId,
        name,
        host,
        port,
        username,
        authenticationType,
        encryptedPassword,
        encryptedPrivateKey,
      },
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "SERVER_CREATE",
      resourceType: "SERVER",
      resourceId: server.id,
      metadata: { name, host },
    });

    return NextResponse.json({
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      authenticationType: server.authenticationType,
      status: server.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
