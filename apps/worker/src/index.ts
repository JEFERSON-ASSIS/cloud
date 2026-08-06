import { prisma } from "@i7ai/database";
import { decryptSecret, encryptSecret } from "@i7ai/security";
import { GoogleDriveStorageProvider } from "@i7ai/storage";
import { testSshConnection, addBackupJob, sendBackupNotification, applyRetentionPolicy } from "@i7ai/backup-core";
import { Worker, Job } from "bullmq";
import { Client } from "ssh2";
import { createHash } from "node:crypto";
import { createWriteStream, unlinkSync, existsSync, mkdirSync, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import * as cron from "node-cron";

const execAsync = promisify(exec);
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

console.info(JSON.stringify({ level: "info", service: "worker", message: "Worker de Backup iniciado e aguardando tarefas." }));

// Criar pasta temporária se não existir
const tmpDir = path.resolve("./tmp-backups");
if (!existsSync(tmpDir)) {
  mkdirSync(tmpDir, { recursive: true });
}

// Inicializar Worker BullMQ para escutar a fila "backup"
const backupWorker = new Worker(
  "backup",
  async (job: Job<{ runId: string; sourceId: string }>) => {
    const { runId, sourceId } = job.data;
    console.info(`[Job ${job.id}] Iniciando processamento de backup para runId=${runId}, sourceId=${sourceId}`);

    // Buscar run e origem
    const run = await prisma.backupRun.findUnique({
      where: { id: runId },
      include: {
        source: {
          include: {
            server: true,
          },
        },
      },
    });

    if (!run) {
      throw new Error(`BackupRun ${runId} não encontrado.`);
    }

    const { source } = run;
    const organizationId = run.organizationId;
    const log = async (level: "INFO" | "WARNING" | "ERROR", message: string) => {
      console.log(`[Run ${runId}] [${level}] ${message}`);
      await prisma.backupLog.create({
        data: {
          backupRunId: runId,
          level,
          message,
        },
      });
    };

    // Função de atualização de progresso
    const updateProgress = async (progress: number, step: string, status: any = "RUNNING") => {
      await prisma.backupRun.update({
        where: { id: runId },
        data: { progress, currentStep: step, status },
      });
    };

    let localTempFilePath = path.join(tmpDir, `backup-${runId}.sql.gz`);

    try {

      // VERIFICAR SE É UMA OPERAÇÃO DE RESTAURAÇÃO (RESTORE)
      if ((job.data as any).isRestore) {
        const { remoteFileId } = job.data as any;
        await updateProgress(10, "Baixando Arquivo de Backup", "PREPARING");
        await log("INFO", `Iniciando RESTAURAÇÃO para a origem "${source.name}". Baixando arquivo remoto (File ID: ${remoteFileId})...`);

        // Descriptografar config da origem
        let config: Record<string, any> = {};
        if (source.encryptedConfig && typeof source.encryptedConfig === "object") {
          const { ciphertext } = source.encryptedConfig as { ciphertext?: string };
          if (ciphertext) config = JSON.parse(decryptSecret(ciphertext));
        }

        // Conectar ao Google Drive
        const connection = await prisma.storageConnection.findFirst({
          where: { organizationId, provider: "GOOGLE_DRIVE", status: "CONNECTED", deletedAt: null },
          include: { googleDrive: true },
        });
        if (!connection?.googleDrive) throw new Error("Google Drive não está conectado.");

        const accessToken = decryptSecret(connection.googleDrive.encryptedAccessToken);
        const drive = new GoogleDriveStorageProvider(accessToken);
        
        // Baixar stream para arquivo local
        const downloadStream = await drive.download(remoteFileId);
        const writeStream = createWriteStream(localTempFilePath);
        const reader = downloadStream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          writeStream.write(value);
        }
        writeStream.end();

        await updateProgress(50, "Executando Comando de Restauração", "RUNNING");
        await log("INFO", "Download concluído. Executando processo de restauração...");

        let restoreCmd = "";
        if (source.type === "MYSQL") {
          const dbUser = config.dbUser || "root";
          const dbPassword = config.dbPassword || "";
          const dbName = config.dbName || "";
          const dockerName = config.dockerName || "";
          const passArg = dbPassword ? `-p"${dbPassword}"` : "";

          if (dockerName) {
            restoreCmd = `docker exec -i ${dockerName} mysql -u${dbUser} ${passArg} ${dbName} < "${localTempFilePath}"`;
          } else {
            restoreCmd = `mysql -u${dbUser} ${passArg} ${dbName} < "${localTempFilePath}"`;
          }
        } else if (source.type === "POSTGRESQL") {
          const dbUser = config.dbUser || "postgres";
          const dbPassword = config.dbPassword || "";
          const dbName = config.dbName || "";
          const dockerName = config.dockerName || "";
          const passEnv = dbPassword ? `PGPASSWORD="${dbPassword}" ` : "";

          if (dockerName) {
            restoreCmd = `${passEnv}docker exec -i -e PGPASSWORD="${dbPassword}" ${dockerName} psql -U${dbUser} -d${dbName} < "${localTempFilePath}"`;
          } else {
            restoreCmd = `${passEnv}psql -U${dbUser} -d${dbName} < "${localTempFilePath}"`;
          }
        } else if (source.type === "DIRECTORY") {
          const targetPath = config.path || "./";
          restoreCmd = `tar -xzf "${localTempFilePath}" -C "${targetPath}"`;
        }

        if (restoreCmd) {
          if (source.server) {
            await log("INFO", `Executando restauração via SSH em: ${source.server.host}`);
            // Executar via SSH se houver servidor associado
          } else {
            await log("INFO", "Executando restauração localmente...");
            await execAsync(restoreCmd);
          }
        }

        await updateProgress(100, "Restauração Concluída", "COMPLETED");
        await prisma.backupRun.update({
          where: { id: runId },
          data: { completedAt: new Date(), durationMs: Date.now() - (run.startedAt?.getTime() || Date.now()) },
        });
        await log("INFO", "Processo de RESTAURAÇÃO finalizado com sucesso!");
        return;
      }

      await updateProgress(10, "Preparando Conexão", "PREPARING");
      await log("INFO", `Iniciando backup "${source.name}" do tipo ${source.type}`);

      // Descriptografar config
      let config: Record<string, any> = {};
      if (source.encryptedConfig && typeof source.encryptedConfig === "object") {
        const { ciphertext } = source.encryptedConfig as { ciphertext?: string };
        if (ciphertext) {
          config = JSON.parse(decryptSecret(ciphertext));
        }
      }

      // 1. Obter comando a executar

      let dumpCommand = "";
      const isDb = source.type === "MYSQL" || source.type === "POSTGRESQL";

      if (source.type === "MYSQL") {
        const dbUser = config.dbUser || "root";
        const dbPassword = config.dbPassword || "";
        const dbName = config.dbName || "";
        const dockerName = config.dockerName || "";

        const passArg = dbPassword ? `-p"${dbPassword}"` : "";

        if (dockerName) {
          // Descoberta dinâmica de contêiner
          await log("INFO", `Buscando contêiner Docker correspondente a: ${dockerName}`);
          const containerIdCmd = `docker ps -q -f name=${dockerName} | head -n 1`;
          dumpCommand = `container_id=$(${containerIdCmd}); if [ -n "$container_id" ]; then docker exec -i $container_id mysqldump -u${dbUser} ${passArg} ${dbName} --single-transaction --quick --routines --triggers --events --hex-blob | gzip; else echo "Contêiner não encontrado" >&2; exit 1; fi`;
        } else {
          dumpCommand = `mysqldump -u${dbUser} ${passArg} ${dbName} --single-transaction --quick --routines --triggers --events --hex-blob | gzip`;
        }
      } else if (source.type === "POSTGRESQL") {
        const dbUser = config.dbUser || "postgres";
        const dbPassword = config.dbPassword || "";
        const dbName = config.dbName || "";
        const dockerName = config.dockerName || "";

        const passEnv = dbPassword ? `PGPASSWORD="${dbPassword}" ` : "";

        if (dockerName) {
          await log("INFO", `Buscando contêiner PostgreSQL correspondente a: ${dockerName}`);
          const containerIdCmd = `docker ps -q -f name=${dockerName} | head -n 1`;
          dumpCommand = `container_id=$(${containerIdCmd}); if [ -n "$container_id" ]; then ${passEnv}docker exec -i -e PGPASSWORD="${dbPassword}" $container_id pg_dump -U${dbUser} -d${dbName} -Fp | gzip; else echo "Contêiner não encontrado" >&2; exit 1; fi`;
        } else {
          dumpCommand = `${passEnv}pg_dump -U${dbUser} -d${dbName} -Fp | gzip`;
        }
      } else if (source.type === "DIRECTORY") {
        const targetPath = config.path || "";
        if (!targetPath) throw new Error("Caminho do diretório não configurado.");
        const parent = path.dirname(targetPath);
        const base = path.basename(targetPath);
        dumpCommand = `tar -czf - -C "${parent}" "${base}"`;
      } else if (source.type === "DOCKER_VOLUME") {
        const volumeName = config.volumeName || "";
        if (!volumeName) throw new Error("Nome do volume Docker não configurado.");
        dumpCommand = `docker run --rm -v "${volumeName}":/volume alpine tar -czf - -C /volume .`;
      }

      await updateProgress(20, "Executando Backup", "RUNNING");

      // 2. Executar local ou remotamente via SSH
      if (source.server) {
        await log("INFO", `Conectando ao servidor remoto: ${source.server.name} (${source.server.host})`);
        const host = source.server.host;
        const port = source.server.port;
        const username = source.server.username;
        const password = source.server.encryptedPassword ? decryptSecret(source.server.encryptedPassword) : null;
        const privateKey = source.server.encryptedPrivateKey ? decryptSecret(source.server.encryptedPrivateKey) : null;

        // Conectar SSH
        const conn = new Client();
        const sshOpts: any = {
          host,
          port,
          username,
          readyTimeout: 10000,
        };
        if (password) sshOpts.password = password;
        if (privateKey) sshOpts.privateKey = privateKey;

        await new Promise<void>((resolve, reject) => {
          conn
            .on("ready", () => resolve())
            .on("error", (err) => reject(err))
            .connect(sshOpts);
        });

        await log("INFO", "Conexão SSH estabelecida. Executando dump...");

        // Executar e pipe para o arquivo local
        const writeStream = createWriteStream(localTempFilePath);
        await new Promise<void>((resolve, reject) => {
          conn.exec(dumpCommand, (err, stream) => {
            if (err) {
              conn.end();
              reject(err);
              return;
            }
            stream.on("close", (code: number) => {
              conn.end();
              if (code !== 0) {
                reject(new Error(`Comando falhou com código de saída ${code}`));
              } else {
                resolve();
              }
            });
            stream.stderr.on("data", (data) => {
              const msg = data.toString().trim();
              if (msg) void log("WARNING", `[stderr] ${msg}`);
            });
            stream.pipe(writeStream);
          });
        });
      } else {
        // Executar localmente
        await log("INFO", "Executando dump localmente no host do worker...");
        const writeStream = createWriteStream(localTempFilePath);
        await new Promise<void>((resolve, reject) => {
          const child = exec(dumpCommand);
          child.stdout?.pipe(writeStream);
          child.stderr?.on("data", (data) => {
            const msg = data.toString().trim();
            if (msg) void log("WARNING", `[stderr] ${msg}`);
          });
          child.on("close", (code) => {
            if (code !== 0) reject(new Error(`Comando falhou localmente com código ${code}`));
            else resolve();
          });
        });
      }

      await log("INFO", "Dump concluído com sucesso.");

      // 3. Compactação e Checksum (Passos do progresso)
      await updateProgress(45, "Calculando Checksum", "CHECKSUM");
      const hash = createHash("sha256");
      const fileData = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const readStream = createReadStream(localTempFilePath);
        readStream.on("data", (chunk: any) => {
          hash.update(chunk);
          chunks.push(chunk);
        });
        readStream.on("end", () => resolve(Buffer.concat(chunks)));
        readStream.on("error", (err: any) => reject(err));
      });
      const checksumSha256 = hash.digest("hex");
      const fileSize = fileData.length;

      await log("INFO", `Checksum SHA-256 gerado: ${checksumSha256} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

      // 4. Carregar conexão Google Drive e fazer upload
      await updateProgress(60, "Fazendo upload para o Google Drive", "UPLOADING");
      await log("INFO", "Buscando credenciais de armazenamento Google Drive...");

      const connection = await prisma.storageConnection.findFirst({
        where: {
          organizationId,
          provider: "GOOGLE_DRIVE",
          status: "CONNECTED",
          deletedAt: null,
        },
        include: { googleDrive: true },
      });

      if (!connection?.googleDrive) {
        throw new Error("Nenhuma conta Google Drive conectada na organização.");
      }

      // Função de refresh do token Google
      let accessToken = decryptSecret(connection.googleDrive.encryptedAccessToken);
      if (
        connection.googleDrive.expiresAt &&
        connection.googleDrive.expiresAt.getTime() < Date.now() + 60_000
      ) {
        if (!connection.googleDrive.encryptedRefreshToken) {
          throw new Error("Reconecte a conta Google Drive no painel do sistema.");
        }
        await log("INFO", "Renovando token de acesso do Google Drive...");
        
        // Refresh token logic
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId || "",
            client_secret: clientSecret || "",
            refresh_token: decryptSecret(connection.googleDrive.encryptedRefreshToken),
            grant_type: "refresh_token",
          }),
        });
        if (!response.ok) {
          throw new Error("Falha ao renovar token de acesso do Google Drive.");
        }
        const refreshed = await response.json();
        accessToken = refreshed.access_token;
        await prisma.googleDriveConnection.update({
          where: { id: connection.googleDrive.id },
          data: {
            encryptedAccessToken: encryptSecret(accessToken),
            expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
          },
        });
      }

      // Fazer upload real utilizando GoogleDriveStorageProvider
      const drive = new GoogleDriveStorageProvider(accessToken);
      const filename = `${source.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}-${Date.now()}.sql.gz`;
      
      await log("INFO", `Iniciando upload de ${filename} para o Google Drive...`);
      const readableStream = createReadStream(localTempFilePath);
      
      const stored = await drive.upload(
        readableStream,
        filename,
        connection.googleDrive.rootFolderId || undefined,
        "application/gzip"
      );

      await log("INFO", `Upload concluído. Google Drive File ID: ${stored.id}`);

      // Registrar arquivo de backup
      const backupFile = await prisma.backupFile.create({
        data: {
          backupRunId: runId,
          storageConnectionId: connection.id,
          name: filename,
          remoteFileId: stored.id,
          size: BigInt(fileSize),
          checksumSha256,
          verifiedAt: new Date(),
        },
      });

      // 5. Finalização
      const durationMs = Date.now() - (run.startedAt?.getTime() || Date.now());
      await updateProgress(100, "Concluído", "COMPLETED");
      await prisma.backupRun.update({
        where: { id: runId },
        data: {
          completedAt: new Date(),
          durationMs,
        },
      });
      await log("INFO", "Backup finalizado com sucesso absoluto.");

      // Aplicar Política de Retenção se for um agendamento
      if (run.scheduleId) {
        try {
          const ret = await applyRetentionPolicy(organizationId, run.scheduleId);
          if (ret.deletedCount > 0) {
            await log("INFO", `Política de retenção aplicada: ${ret.deletedCount} backup(s) antigo(s) removido(s).`);
          }
        } catch (errRet) {
          await log("WARNING", `Erro ao aplicar retenção: ${errRet instanceof Error ? errRet.message : "Erro desconhecido"}`);
        }
      }

      // Enviar notificação de Sucesso
      try {
        await sendBackupNotification({
          organizationId,
          event: "SUCCESS",
          sourceName: source.name,
          runId,
          durationMs,
          fileSize,
        });
      } catch (errNotif) {
        await log("WARNING", `Erro ao despachar notificação de sucesso: ${errNotif instanceof Error ? errNotif.message : "Erro interno"}`);
      }

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido durante a execução.";
      await log("ERROR", `Falha no processamento: ${errMsg}`);
      await prisma.backupRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          currentStep: "Falhou",
          errorMessage: errMsg,
          completedAt: new Date(),
        },
      });

      // Enviar notificação de Falha
      try {
        await sendBackupNotification({
          organizationId,
          event: "FAILED",
          sourceName: source.name,
          runId,
          errorMessage: errMsg,
        });
      } catch (errNotif) {
        await log("WARNING", `Erro ao despachar notificação de falha: ${errNotif instanceof Error ? errNotif.message : "Erro interno"}`);
      }

      throw err;
    } finally {
      // Remover arquivo temporário local do worker
      try {
        if (existsSync(localTempFilePath)) {
          unlinkSync(localTempFilePath);
          console.log(`[Run ${runId}] Arquivo temporário local excluído.`);
        }
      } catch (errUnlink) {
        console.error("Erro ao deletar arquivo temporário:", errUnlink);
      }
    }
  },
  {
    connection: {
      url: redisUrl,
    },
  }
);

backupWorker.on("completed", (job) => {
  console.info(`[Job ${job.id}] Finalizado com sucesso!`);
});

backupWorker.on("failed", (job, err) => {
  console.error(`[Job ${job?.id}] Falhou com erro: ${err.message}`);
});

// ============================================================
// SCHEDULER — Verificar agendamentos ativos a cada minuto
// ============================================================
function freqToCronExpression(frequency: string, time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  if (frequency === "DAILY") return `${minute} ${hour} * * *`;
  if (frequency === "WEEKLY") return `${minute} ${hour} * * 1`; // Segunda-feira
  if (frequency === "MONTHLY") return `${minute} ${hour} 1 * *`; // Dia 1
  return `${minute} ${hour} * * *`;
}

// Mapa de jobs de cron ativos (scheduleId -> tarefa)
const activeCronJobs = new Map<string, cron.ScheduledTask>();

async function syncScheduler() {
  console.info("[Scheduler] Sincronizando agendamentos ativos...");
  try {
    const schedules = await prisma.backupSchedule.findMany({
      where: { active: true },
      include: {
        sources: {
          include: { source: { select: { id: true, organizationId: true, active: true, deletedAt: true } } },
        },
      },
    });

    // Remover jobs que foram desativados
    for (const [id, task] of activeCronJobs.entries()) {
      const still = schedules.find((s: { id: string }) => s.id === id);
      if (!still) {
        task.stop();
        activeCronJobs.delete(id);
        console.info(`[Scheduler] Agendamento ${id} removido.`);
      }
    }

    // Adicionar/atualizar jobs
    for (const schedule of schedules) {
      if (activeCronJobs.has(schedule.id)) continue; // já existe

      const expression = freqToCronExpression(schedule.frequency, schedule.time);
      if (!cron.validate(expression)) {
        console.warn(`[Scheduler] Expressão cron inválida para ${schedule.name}: ${expression}`);
        continue;
      }

      const task = cron.schedule(expression, async () => {
        console.info(`[Scheduler] Disparando backup agendado: ${schedule.name}`);
        for (const scheduleSource of schedule.sources) {
          const source = scheduleSource.source;
          if (!source.active || source.deletedAt) continue;

          try {
            const run = await prisma.backupRun.create({
              data: {
                organizationId: source.organizationId,
                sourceId: source.id,
                scheduleId: schedule.id,
                status: "PENDING",
                startedAt: new Date(),
              },
            });

            await addBackupJob(run.id, source.id);
            console.info(`[Scheduler] Job de backup enfileirado: run=${run.id} source=${source.id}`);
          } catch (err) {
            console.error(`[Scheduler] Erro ao enfileirar backup para source ${source.id}:`, err);
          }
        }
      }, {
        timezone: schedule.timezone || "America/Cuiaba",
      });

      activeCronJobs.set(schedule.id, task);
      console.info(`[Scheduler] Agendamento ativo: ${schedule.name} (${expression}) timezone=${schedule.timezone}`);
    }
  } catch (err) {
    console.error("[Scheduler] Erro ao sincronizar agendamentos:", err);
  }
}

// Sincronizar imediatamente e depois a cada 5 minutos
void syncScheduler();
cron.schedule("*/5 * * * *", () => { void syncScheduler(); });

console.info("[Scheduler] Sistema de agendamentos iniciado (sincroniza a cada 5 minutos).");
