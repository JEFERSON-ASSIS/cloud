import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { encryptSecret, decryptSecret } from "@/server/encryption";
import { writeAudit } from "@/server/audit";
import { assertSectorAccess } from "@/server/sector-access";
import { addBackupJob } from "@i7ai/backup-core";
import { z } from "zod";
import { hasBackupSecrets, mergeBackupConfig, sanitizeBackupConfig } from "@/server/backup-config";

const updateSourceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").optional(),
  serverId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  config: z.record(z.string(), z.any()).optional(),
}).superRefine((data, ctx) => {
  if (data.config) {
    const config = data.config;
    if (config.host !== undefined && (typeof config.host !== "string" || config.host.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host do banco de dados não pode ser vazio.",
        path: ["config", "host"],
      });
    }
    if (config.port !== undefined && (isNaN(Number(config.port)) || Number(config.port) <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Porta do banco de dados deve ser válida.",
        path: ["config", "port"],
      });
    }
    if (config.dbName !== undefined && (typeof config.dbName !== "string" || config.dbName.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nome do banco de dados não pode ser vazio.",
        path: ["config", "dbName"],
      });
    }
    if (config.dbUser !== undefined && (typeof config.dbUser !== "string" || config.dbUser.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Usuário do banco de dados não pode ser vazio.",
        path: ["config", "dbUser"],
      });
    }
  }
});

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.read",
      request,
    );
    const { id } = await params;

    const source = await prisma.backupSource.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
      include: {
        server: {
          select: { name: true },
        },
      },
    });

    await assertSectorAccess(tenant.userId, organizationId, source.sectorId, tenant.role, "VIEWER_DOWNLOAD");

    let config = {};
    if (source.encryptedConfig && typeof source.encryptedConfig === "object") {
      const { ciphertext } = source.encryptedConfig as { ciphertext?: string };
      if (ciphertext) {
        config = JSON.parse(decryptSecret(ciphertext));
      }
    }

    const configRecord = config as Record<string, unknown>;
    return NextResponse.json({
      id: source.id,
      name: source.name,
      type: source.type,
      sectorId: source.sectorId,
      serverId: source.serverId,
      serverName: source.server?.name || "Local",
      active: source.active,
      createdAt: source.createdAt,
      config: sanitizeBackupConfig(configRecord),
      hasSecretConfig: hasBackupSecrets(configRecord),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const body = await request.json();
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.manage",
      request,
      typeof body?.organizationId === "string" ? body.organizationId : null,
    );
    const { id } = await params;

    const source = await prisma.backupSource.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
    });

    await assertSectorAccess(tenant.userId, organizationId, source.sectorId, tenant.role, "EDITOR");

    const result = updateSourceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || result.error.message }, { status: 400 });
    }

    const { name, serverId, active, config } = result.data;
    const data: Record<string, unknown> = {};

    if (name !== undefined) data.name = name;
    if (active !== undefined) data.active = active;

    if (serverId !== undefined) {
      if (serverId) {
        await prisma.server.findFirstOrThrow({
          where: { id: serverId, organizationId, deletedAt: null },
        });
      }
      data.serverId = serverId;
    }

    if (config !== undefined) {
      let currentConfig: Record<string, unknown> = {};
      if (source.encryptedConfig && typeof source.encryptedConfig === "object") {
        const { ciphertext: currentCiphertext } = source.encryptedConfig as { ciphertext?: string };
        if (currentCiphertext) currentConfig = JSON.parse(decryptSecret(currentCiphertext)) as Record<string, unknown>;
      }
      const ciphertext = encryptSecret(JSON.stringify(mergeBackupConfig(currentConfig, config)));
      data.encryptedConfig = { ciphertext };
    }

    const updated = await prisma.backupSource.update({
      where: { id },
      data,
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "BACKUP_SOURCE_UPDATE",
      resourceType: "BACKUP_SOURCE",
      resourceId: id,
      metadata: { id, name: updated.name, sectorId: updated.sectorId },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      sectorId: updated.sectorId,
      serverId: updated.serverId,
      active: updated.active,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.manage",
      request,
    );
    const { id } = await params;

    const source = await prisma.backupSource.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
    });

    await assertSectorAccess(tenant.userId, organizationId, source.sectorId, tenant.role, "ADMIN");

    await prisma.backupSource.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "BACKUP_SOURCE_DELETE",
      resourceType: "BACKUP_SOURCE",
      resourceId: id,
      metadata: { id, name: source.name, sectorId: source.sectorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Disparar backup manual
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.manage",
      request,
    );
    const { id } = await params;

    const source = await prisma.backupSource.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
    });

    await assertSectorAccess(tenant.userId, organizationId, source.sectorId, tenant.role, "EDITOR");

    const run = await prisma.backupRun.create({
      data: {
        organizationId,
        sectorId: source.sectorId,
        sourceId: id,
        status: "PENDING",
        progress: 0,
        startedAt: new Date(),
        currentStep: "Enfileirado",
      },
    });

    try {
      await addBackupJob(run.id, source.id);
    } catch (error) {
      await prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: "Falha ao enfileirar job no Redis.",
          completedAt: new Date(),
          currentStep: "Falha ao enfileirar",
        },
      });
      throw error;
    }

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "BACKUP_STARTED",
      resourceType: "BACKUP_RUN",
      resourceId: run.id,
      metadata: { sourceId: id, sourceName: source.name, sectorId: source.sectorId },
    });

    return NextResponse.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
