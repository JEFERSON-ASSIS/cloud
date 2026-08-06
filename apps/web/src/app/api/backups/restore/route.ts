import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { addBackupJob } from "@i7ai/backup-core";

export async function POST(req: Request) {
  try {
    const tenant = await requireTenant("backup.manage");
    const body = await req.json();
    const { backupRunId, targetServerId } = body;

    if (!backupRunId) {
      return NextResponse.json({ error: "ID do backup (backupRunId) é obrigatório." }, { status: 400 });
    }

    // Buscar o backup run e o arquivo gerado
    const originalRun = await prisma.backupRun.findFirst({
      where: {
        id: backupRunId,
        organizationId: tenant.organizationId!,
      },
      include: {
        source: true,
        files: true,
      },
    });

    if (!originalRun || !originalRun.files || originalRun.files.length === 0) {
      return NextResponse.json({ error: "Backup ou arquivo de backup não encontrado." }, { status: 404 });
    }

    const backupFile = originalRun.files[0];
    if (!backupFile) {
      return NextResponse.json({ error: "Arquivo de backup não encontrado." }, { status: 404 });
    }



    // Criar um novo BackupRun com tipo RESTORE
    const restoreRun = await prisma.backupRun.create({
      data: {
        organizationId: tenant.organizationId!,
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

    // Enfileirar a tarefa de restauração no worker
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
