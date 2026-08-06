import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { encryptSecret } from "@/server/encryption";
import { writeAudit } from "@/server/audit";
import { z } from "zod";

const createSourceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["MYSQL", "POSTGRESQL", "DOCKER_VOLUME", "DIRECTORY"]),
  serverId: z.string().uuid().nullable().optional(),
  config: z.record(z.string(), z.any()), // Objeto com campos de configuração específicos
});

export async function GET() {
  try {
    const tenant = await requireTenant("backup.read");
    const organizationId = tenant.organizationId!;

    const sources = await prisma.backupSource.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        server: {
          select: { name: true, host: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Remove as chaves de configuração sensíveis (só envia tipo de origem)
    const sanitized = sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      serverId: s.serverId,
      serverName: s.server?.name || "Local",
      active: s.active,
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
    const result = createSourceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || result.error.message }, { status: 400 });
    }

    const { name, type, serverId, config } = result.data;

    // Verificar se servidor pertence à organização se fornecido
    if (serverId) {
      await prisma.server.findFirstOrThrow({
        where: { id: serverId, organizationId, deletedAt: null },
      });
    }

    // Criptografar as configurações
    const ciphertext = encryptSecret(JSON.stringify(config));
    const encryptedConfig = { ciphertext };

    const source = await prisma.backupSource.create({
      data: {
        organizationId,
        name,
        type,
        encryptedConfig,
        ...(serverId ? { serverId } : {}),
      } as any,
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "BACKUP_SOURCE_CREATE",
      resourceType: "BACKUP_SOURCE",
      resourceId: source.id,
      metadata: { name, type },
    });

    return NextResponse.json({
      id: source.id,
      name: source.name,
      type: source.type,
      serverId: source.serverId,
      active: source.active,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
