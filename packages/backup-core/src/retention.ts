import { prisma } from "@i7ai/database";
import { GoogleDriveStorageProvider } from "@i7ai/storage";
import { decryptSecret } from "@i7ai/security";

export async function applyRetentionPolicy(
  organizationId: string,
  scheduleId: string
): Promise<{ deletedCount: number; errors: string[] }> {
  const schedule = await prisma.backupSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    return { deletedCount: 0, errors: [] };
  }

  const maxRetention = schedule.retentionDaily || 7;

  // Buscar execuções concluídas organizadas por data mais recente
  const runs = await prisma.backupRun.findMany({
    where: {
      organizationId,
      scheduleId,
      status: "COMPLETED",
    },
    include: {
      files: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (runs.length <= maxRetention) {
    return { deletedCount: 0, errors: [] };
  }

  // runs além da quantidade máxima de retenção
  const runsToDelete = runs.slice(maxRetention);
  let deletedCount = 0;
  const errors: string[] = [];

  // Buscar conexão ativa do Google Drive da organização
  const connection = await prisma.storageConnection.findFirst({
    where: {
      organizationId,
      provider: "GOOGLE_DRIVE",
      status: "CONNECTED",
      deletedAt: null,
    },
    include: { googleDrive: true },
  });

  let drive: GoogleDriveStorageProvider | null = null;
  if (connection?.googleDrive) {
    try {
      const accessToken = decryptSecret(connection.googleDrive.encryptedAccessToken);
      drive = new GoogleDriveStorageProvider(accessToken);
    } catch (err) {
      errors.push(`Erro ao inicializar Google Drive para retenção: ${err instanceof Error ? err.message : "Desconhecido"}`);
    }
  }

  for (const run of runsToDelete) {
    for (const file of run.files) {
      if (drive && file.remoteFileId) {
        try {
          await drive.delete(file.remoteFileId);
        } catch (err) {
          errors.push(`Erro ao apagar arquivo remoto ${file.remoteFileId}: ${err instanceof Error ? err.message : "Desconhecido"}`);
        }
      }
      try {
        await prisma.backupFile.delete({ where: { id: file.id } });
      } catch (err) {
        // ignore if deleted
      }
    }

    try {
      await prisma.backupRun.delete({ where: { id: run.id } });
      deletedCount++;
    } catch (err) {
      errors.push(`Erro ao apagar registro de run ${run.id}`);
    }
  }

  return { deletedCount, errors };
}
