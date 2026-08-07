import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { encryptSecret } from "@/server/encryption";
import { writeAudit } from "@/server/audit";
import { assertSectorAccess, getUserSectorIds } from "@/server/sector-access";
import { z } from "zod";

const createSourceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["MYSQL", "POSTGRESQL", "DOCKER_VOLUME", "DIRECTORY"]),
  sectorId: z.string().uuid("Secretaria é obrigatória"),
  serverId: z.string().uuid().nullable().optional(),
  config: z.record(z.string(), z.any()),
});

export async function GET() {
  try {
    const tenant = await requireTenant("backup.read");
    const organizationId = tenant.organizationId!;
    const allowedSectorIds = await getUserSectorIds(tenant.userId, organizationId, tenant.role);

    const whereClause: any = { organizationId, deletedAt: null };
    if (allowedSectorIds !== null) {
      whereClause.OR = [
        { sectorId: { in: allowedSectorIds } },
        { sectorId: null },
      ];
    }

    const sources = await prisma.backupSource.findMany({
      where: whereClause,
      include: {
        server: {
          select: { name: true, host: true },
        },
        sector: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sanitized = sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      sectorId: s.sectorId,
      sectorName: s.sector?.name || "Sem Secretaria",
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

    const { name, type, sectorId, serverId, config } = result.data;

    await prisma.sector.findFirstOrThrow({
      where: { id: sectorId, organizationId, deletedAt: null },
    });

    await assertSectorAccess(tenant.userId, organizationId, sectorId, tenant.role, "EDITOR");

    if (serverId) {
      await prisma.server.findFirstOrThrow({
        where: { id: serverId, organizationId, deletedAt: null },
      });
    }

    const ciphertext = encryptSecret(JSON.stringify(config));
    const encryptedConfig = { ciphertext };

    const source = await prisma.backupSource.create({
      data: {
        organizationId,
        sectorId,
        name,
        type,
        encryptedConfig,
        ...(serverId ? { serverId } : {}),
      },
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "BACKUP_SOURCE_CREATE",
      resourceType: "BACKUP_SOURCE",
      resourceId: source.id,
      metadata: { name, type, sectorId },
    });

    return NextResponse.json({
      id: source.id,
      name: source.name,
      type: source.type,
      sectorId: source.sectorId,
      serverId: source.serverId,
      active: source.active,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
