import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { assertSectorAccess } from "@/server/sector-access";
import { writeAudit } from "@/server/audit";
import { addBackupJob } from "@i7ai/backup-core";
import { z } from "zod";

const restoreSchema = z.object({
  backupRunId: z.string().uuid(),
  targetServerId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.manage",
      req,
      typeof body?.organizationId === "string" ? body.organizationId : null,
    );
    const { backupRunId, targetServerId } = restoreSchema.parse(body);

    const originalRun = await prisma.backupRun.findFirst({
      where: {
        id: backupRunId,
        organizationId,
      },
      include: {
        source: true,
        files: true,
      },
    });

    if (!originalRun || !originalRun.files || originalRun.files.length === 0) {
      return NextResponse.json({ error: "Backup ou arquivo de backup não encontrado." }, { status: 404 });
    }

    await assertSectorAccess(tenant.userId, organizationId, originalRun.sectorId, tenant.role, "ADMIN");

    if (targetServerId) {
      const targetServer = await prisma.server.findFirst({ where: { id: targetServerId, organizationId, deletedAt: null } });
      if (!targetServer) return NextResponse.json({ error: "Servidor de destino inválido para esta empresa." }, { status: 400 });
    }

    const backupFile = originalRun.files[0];
    if (!backupFile) {
      return NextResponse.json({ error: "Arquivo de backup não encontrado." }, { status: 404 });
    }

    const restoreRun = await prisma.backupRun.create({
      data: {
        organizationId,
        sectorId: originalRun.sectorId,
        sourceId: originalRun.sourceId,
        status: "PREPARING",
        currentStep: "Iniciando Restauração",
        startedAt: new Date(),
      },
    });

    await prisma.backupLog.create({
      data: {
        backupRunId: restoreRun.id,
        level: "INFO",
        message: `Solicitação de restauração iniciada para o arquivo "${backupFile.name}" (File ID: ${backupFile.remoteFileId}).`,
      },
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "BACKUP_RESTORE",
      resourceType: "BackupRun",
      resourceId: restoreRun.id,
      metadata: { originalRunId: originalRun.id, sectorId: originalRun.sectorId },
    });

    try {
      await addBackupJob(restoreRun.id, originalRun.sourceId, {
        isRestore: true,
        originalRunId: originalRun.id,
        remoteFileId: backupFile.remoteFileId,
        storageConnectionId: backupFile.storageConnectionId,
        targetServerId: targetServerId || originalRun.source.serverId || undefined,
      });
    } catch (error) {
      await prisma.backupRun.update({
        where: { id: restoreRun.id },
        data: {
          status: "FAILED",
          errorMessage: "Falha ao enfileirar restauração no Redis.",
          completedAt: new Date(),
          currentStep: "Falha ao enfileirar",
        },
      });
      throw error;
    }

    return NextResponse.json({
      success: true,
      restoreRunId: restoreRun.id,
      message: "Restauração enfileirada com sucesso. Acompanhe o progresso na tela de Logs.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao iniciar restauração";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
