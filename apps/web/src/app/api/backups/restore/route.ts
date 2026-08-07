import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { assertSectorAccess } from "@/server/sector-access";
import { writeAudit } from "@/server/audit";
import { addBackupJob } from "@i7ai/backup-core";

export async function POST(req: Request) {
  try {
    const tenant = await requireTenant("backup.manage");
    const organizationId = tenant.organizationId!;
    const body = await req.json();
    const { backupRunId, targetServerId } = body;

    if (!backupRunId) {
      return NextResponse.json({ error: "ID do backup (backupRunId) é obrigatório." }, { status: 400 });
    }

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

    await addBackupJob(restoreRun.id, originalRun.sourceId, {
      isRestore: true,
      originalRunId: originalRun.id,
      remoteFileId: backupFile.remoteFileId,
      storageConnectionId: backupFile.storageConnectionId,
      targetServerId: targetServerId || originalRun.source.serverId || undefined,
    });

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
