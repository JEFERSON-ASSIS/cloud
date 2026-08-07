import { prisma } from "@i7ai/database";
import { GoogleDriveStorageProvider } from "@i7ai/storage";
import { decryptSecret } from "@i7ai/security";

type RunWithFiles = {
  id: string;
  createdAt: Date;
  files: { id: string; remoteFileId: string | null }[];
};

function weekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function selectRunsToDelete(
  runsNewestFirst: RunWithFiles[],
  retentionDaily: number,
  retentionWeekly: number,
  retentionMonthly: number,
): RunWithFiles[] {
  const keep = new Set<string>();

  for (const run of runsNewestFirst.slice(0, Math.max(0, retentionDaily))) {
    keep.add(run.id);
  }

  const weeklySeen = new Set<string>();
  for (const run of runsNewestFirst) {
    if (weeklySeen.size >= Math.max(0, retentionWeekly)) break;
    const key = weekKey(run.createdAt);
    if (weeklySeen.has(key)) continue;
    weeklySeen.add(key);
    keep.add(run.id);
  }

  const monthlySeen = new Set<string>();
  for (const run of runsNewestFirst) {
    if (monthlySeen.size >= Math.max(0, retentionMonthly)) break;
    const key = monthKey(run.createdAt);
    if (monthlySeen.has(key)) continue;
    monthlySeen.add(key);
    keep.add(run.id);
  }

  return runsNewestFirst.filter((run) => !keep.has(run.id));
}

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

  const retentionDaily = schedule.retentionDaily || 7;
  const retentionWeekly = schedule.retentionWeekly || 0;
  const retentionMonthly = schedule.retentionMonthly || 0;

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

  const runsToDelete = selectRunsToDelete(
    runs,
    retentionDaily,
    retentionWeekly,
    retentionMonthly,
  );
  let deletedCount = 0;
  const errors: string[] = [];

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
    let remoteDeleteFailed = false;
    for (const file of run.files) {
      if (drive && file.remoteFileId) {
        try {
          await drive.delete(file.remoteFileId);
        } catch (err) {
          remoteDeleteFailed = true;
          errors.push(`Erro ao apagar arquivo remoto ${file.remoteFileId}: ${err instanceof Error ? err.message : "Desconhecido"}`);
        }
      }
    }

    if (remoteDeleteFailed) {
      errors.push(`Retenção adiada para run ${run.id}: falha ao apagar arquivo remoto.`);
      continue;
    }

    for (const file of run.files) {
      try {
        await prisma.backupFile.delete({ where: { id: file.id } });
      } catch {
        // ignore if already deleted
      }
    }

    try {
      await prisma.backupRun.delete({ where: { id: run.id } });
      deletedCount++;
    } catch {
      errors.push(`Erro ao apagar registro de run ${run.id}`);
    }
  }

  return { deletedCount, errors };
}
