import { prisma } from "@i7ai/database";
import { decryptSecret, encryptSecret, encryptFile, decryptFile } from "@i7ai/security";
import { GoogleDriveStorageProvider } from "@i7ai/storage";
import { testSshConnection, executeSshCommandWithInput, addBackupJob, sendBackupNotification, applyRetentionPolicy } from "@i7ai/backup-core";
import { Worker, Job } from "bullmq";
import { Client } from "ssh2";
import { createHash } from "node:crypto";
import { createWriteStream, unlinkSync, existsSync, mkdirSync, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { exec, execFile } from "node:child_process";
import { createGzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";
import * as cron from "node-cron";

const execAsync = promisify(exec);
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

type BackupJobData = {
  runId: string;
  sourceId: string;
  isRestore?: boolean;
  remoteFileId?: string;
  targetServerId?: string;
};

console.info(JSON.stringify({ level: "info", service: "worker", message: "Worker de Backup iniciado e aguardando tarefas." }));

// Criar pasta temporária se não existir
const tmpDir = path.resolve("./tmp-backups");
if (!existsSync(tmpDir)) {
  mkdirSync(tmpDir, { recursive: true });
}

// Inicializar Worker BullMQ para escutar a fila "backup"
const backupWorker = new Worker(
  "backup",
  async (job: Job<BackupJobData>) => {
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
    let config: Record<string, any> = {};

    try {

      // VERIFICAR SE É UMA OPERAÇÃO DE RESTAURAÇÃO (RESTORE)
      if (job.data.isRestore) {
        const { remoteFileId, targetServerId } = job.data;
        if (!remoteFileId) throw new Error("Arquivo remoto não informado para restauração.");
        await updateProgress(10, "Baixando Arquivo de Backup", "PREPARING");
        await log("INFO", `Iniciando RESTAURAÇÃO para a origem "${source.name}". Baixando arquivo remoto (File ID: ${remoteFileId})...`);

        // Descriptografar config da origem
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
        await pipeline(Readable.fromWeb(downloadStream as never), createWriteStream(localTempFilePath));

        let restoreFilePath = localTempFilePath;
        const meta = await drive.getMetadata(remoteFileId);
        if (meta.name.endsWith(".enc")) {
          await log("INFO", "Arquivo de backup criptografado (.enc) detectado. Descriptografando com AES-256...");
          restoreFilePath = path.join(tmpDir, `backup-decrypted-${runId}.sql.gz`);
          await decryptFile(localTempFilePath, restoreFilePath);
        }

        await updateProgress(50, "Executando Comando de Restauração", "RUNNING");
        await log("INFO", "Download e descriptografia concluídos. Executando processo de restauração...");

        const shellQuote = (value: unknown) => `'${String(value).replaceAll("'", `'\\''`)}'`;
        const dockerName = String(config.dockerName || "");
        if (dockerName && !/^[a-zA-Z0-9_.-]+$/.test(dockerName)) throw new Error("Nome de container Docker inválido.");
        let localRestoreCmd = "";
        let remoteRestoreCmd = "";
        if (source.type === "MYSQL") {
          const dbUser = config.dbUser || "root";
          const dbPassword = config.dbPassword || "";
          const dbName = config.dbName || "";
          const env = dbPassword ? `MYSQL_PWD=${shellQuote(dbPassword)} ` : "";
          if (dockerName) {
            remoteRestoreCmd = `gzip -dc | docker exec -i -e MYSQL_PWD=${shellQuote(dbPassword)} ${shellQuote(dockerName)} mysql -u ${shellQuote(dbUser)} ${shellQuote(dbName)}`;
          } else {
            remoteRestoreCmd = `gzip -dc | ${env}mysql -u ${shellQuote(dbUser)} ${shellQuote(dbName)}`;
          }
          localRestoreCmd = remoteRestoreCmd.replace("gzip -dc", `gzip -dc ${shellQuote(restoreFilePath)}`);
        } else if (source.type === "POSTGRESQL") {
          const dbUser = config.dbUser || "postgres";
          const dbPassword = config.dbPassword || "";
          const dbName = config.dbName || "";
          const passEnv = dbPassword ? `PGPASSWORD=${shellQuote(dbPassword)} ` : "";
          if (dockerName) {
            remoteRestoreCmd = `gzip -dc | docker exec -i -e PGPASSWORD=${shellQuote(dbPassword)} ${shellQuote(dockerName)} psql -U ${shellQuote(dbUser)} -d ${shellQuote(dbName)}`;
          } else {
            remoteRestoreCmd = `gzip -dc | ${passEnv}psql -U ${shellQuote(dbUser)} -d ${shellQuote(dbName)}`;
          }
          localRestoreCmd = remoteRestoreCmd.replace("gzip -dc", `gzip -dc ${shellQuote(restoreFilePath)}`);
        } else if (source.type === "DIRECTORY") {
          const targetPath = config.path || "./";
          remoteRestoreCmd = `tar -xzf - -C ${shellQuote(targetPath)}`;
          localRestoreCmd = `tar -xzf ${shellQuote(restoreFilePath)} -C ${shellQuote(targetPath)}`;
        } else {
          throw new Error(`Restauração não suportada para o tipo ${source.type}.`);
        }

        const targetServer = targetServerId
          ? await prisma.server.findFirst({ where: { id: targetServerId, organizationId, deletedAt: null } })
          : source.server;
        if (targetServerId && !targetServer) throw new Error("Servidor de destino não encontrado ou removido.");
        if (targetServer) {
            await log("INFO", `Executando restauração via SSH em: ${targetServer.host}`);
            await executeSshCommandWithInput({
              host: targetServer.host,
              port: targetServer.port,
              username: targetServer.username,
              password: targetServer.encryptedPassword ? decryptSecret(targetServer.encryptedPassword) : null,
              privateKey: targetServer.encryptedPrivateKey ? decryptSecret(targetServer.encryptedPrivateKey) : null,
            }, remoteRestoreCmd, restoreFilePath);
          } else {
            await log("INFO", "Executando restauração localmente...");
            await execAsync(localRestoreCmd);
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
      if (source.encryptedConfig && typeof source.encryptedConfig === "object") {
        const { ciphertext } = source.encryptedConfig as { ciphertext?: string };
        if (ciphertext) {
          config = JSON.parse(decryptSecret(ciphertext));
        }
      }

      // 1. Obter executável e argumentos estruturados (previne command injection)
      let execCommand = "";
      let execArgs: string[] = [];
      let extraEnv: Record<string, string> = {};
      let isAlreadyCompressed = false;
      let remoteSshCmd = "";

      if (source.type === "MYSQL") {
        if (!config.host || !config.port) {
          throw new Error("Origem de backup precisa ser atualizada com Host e Porta.");
        }

        const host = String(config.host).trim();
        const port = Number(config.port);
        const dbUser = String(config.dbUser || "").trim();
        const dbPassword = String(config.dbPassword || "");
        const dbName = String(config.dbName || ""); // NUNCA EXECUTAR TRIM() EM DBNAME PARA PRESERVAR BANCOS LEGADOS
        const dockerName = String(config.dockerName || "").trim();

        if (dbPassword) {
          extraEnv.MYSQL_PWD = dbPassword;
        }

        if (dockerName) {
          await log("INFO", `Executando mysqldump via Docker no contêiner: ${dockerName}`);
          execCommand = "docker";
          execArgs = [
            "exec",
            "-i",
            ...(dbPassword ? ["-e", `MYSQL_PWD=${dbPassword}`] : []),
            dockerName,
            "mysqldump",
            "-h",
            host,
            "-P",
            String(port),
            "-u",
            dbUser,
            "--single-transaction",
            "--quick",
            "--routines",
            "--triggers",
            "--events",
            "--hex-blob",
            "--default-character-set=utf8mb4",
            dbName,
          ];
        } else {
          execCommand = "mysqldump";
          execArgs = [
            "-h",
            host,
            "-P",
            String(port),
            "-u",
            dbUser,
            "--single-transaction",
            "--quick",
            "--routines",
            "--triggers",
            "--events",
            "--hex-blob",
            "--default-character-set=utf8mb4",
            dbName,
          ];
        }
        remoteSshCmd = `MYSQL_PWD="${dbPassword.replace(/"/g, '\\"')}" mysqldump -h "${host}" -P ${port} -u "${dbUser}" "${dbName}" --single-transaction --quick --routines --triggers --events --hex-blob --default-character-set=utf8mb4 | gzip`;
      } else if (source.type === "POSTGRESQL") {
        if (!config.host || !config.port) {
          throw new Error("Origem de backup precisa ser atualizada com Host e Porta.");
        }

        const host = String(config.host).trim();
        const port = Number(config.port);
        const dbUser = String(config.dbUser || "").trim();
        const dbPassword = String(config.dbPassword || "");
        const dbName = String(config.dbName || ""); // NUNCA EXECUTAR TRIM() EM DBNAME PARA PRESERVAR BANCOS LEGADOS
        const dockerName = String(config.dockerName || "").trim();

        if (dbPassword) {
          extraEnv.PGPASSWORD = dbPassword;
        }

        if (dockerName) {
          await log("INFO", `Executando pg_dump via Docker no contêiner: ${dockerName}`);
          execCommand = "docker";
          execArgs = [
            "exec",
            "-i",
            ...(dbPassword ? ["-e", `PGPASSWORD=${dbPassword}`] : []),
            dockerName,
            "pg_dump",
            "-h",
            host,
            "-p",
            String(port),
            "-U",
            dbUser,
            "-d",
            dbName,
            "-Fp",
          ];
        } else {
          execCommand = "pg_dump";
          execArgs = [
            "-h",
            host,
            "-p",
            String(port),
            "-U",
            dbUser,
            "-d",
            dbName,
            "-Fp",
          ];
        }
        remoteSshCmd = `PGPASSWORD="${dbPassword.replace(/"/g, '\\"')}" pg_dump -h "${host}" -p ${port} -U "${dbUser}" -d "${dbName}" -Fp | gzip`;
      } else if (source.type === "DIRECTORY") {
        const targetPath = config.path || "";
        if (!targetPath) throw new Error("Caminho do diretório não configurado.");
        const parent = path.dirname(targetPath);
        const base = path.basename(targetPath);
        execCommand = "tar";
        execArgs = ["-czf", "-", "-C", parent, base];
        isAlreadyCompressed = true;
        remoteSshCmd = `tar -czf - -C "${parent}" "${base}"`;
      } else if (source.type === "DOCKER_VOLUME") {
        const volumeName = config.volumeName || "";
        if (!volumeName) throw new Error("Nome do volume Docker não configurado.");
        execCommand = "docker";
        execArgs = ["run", "--rm", "-v", `${volumeName}:/volume`, "alpine", "tar", "-czf", "-", "-C", "/volume", "."];
        isAlreadyCompressed = true;
        remoteSshCmd = `docker run --rm -v "${volumeName}":/volume alpine tar -czf - -C /volume .`;
      }

      await updateProgress(20, "Executando Backup", "RUNNING");

      const rawPassword = String(config.dbPassword || "");
      const sanitizeText = (txt: string) => {
        if (!rawPassword) return txt;
        return txt.replaceAll(rawPassword, "[PASSWORD_REDACTED]");
      };

      // 2. Executar local ou remotamente via SSH
      if (source.server) {
        await log("INFO", `Conectando ao servidor remoto: ${source.server.name} (${source.server.host})`);
        const host = source.server.host;
        const port = source.server.port;
        const username = source.server.username;
        const password = source.server.encryptedPassword ? decryptSecret(source.server.encryptedPassword) : null;
        const privateKey = source.server.encryptedPrivateKey ? decryptSecret(source.server.encryptedPrivateKey) : null;

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

        await log("INFO", "Conexão SSH estabelecida. Executando dump remoto...");

        const writeStream = createWriteStream(localTempFilePath);
        await new Promise<void>((resolve, reject) => {
          conn.exec(remoteSshCmd, (err, stream) => {
            if (err) {
              conn.end();
              reject(err);
              return;
            }
            stream.on("close", (code: number) => {
              conn.end();
              if (code !== 0) {
                reject(new Error(`Comando remoto falhou com código de saída ${code}`));
              } else {
                resolve();
              }
            });
            stream.stderr.on("data", (data) => {
              const msg = sanitizeText(data.toString().trim());
              if (msg) void log("WARNING", `[stderr] ${msg}`);
            });
            stream.pipe(writeStream);
          });
        });
      } else {
        // Executar localmente via execFile seguro (sem passar pela shell)
        const safeArgs = execArgs.map((arg) => (rawPassword && arg.includes(rawPassword) ? "[PASSWORD_REDACTED]" : arg));
        await log("INFO", `Executando dump local seguro: ${execCommand} ${safeArgs.join(" ")}`);
        const writeStream = createWriteStream(localTempFilePath);

        await new Promise<void>((resolve, reject) => {
          const child = execFile(
            execCommand,
            execArgs,
            { env: { ...process.env, ...extraEnv } },
            (err) => {
              if (err && err.code !== 0) {
                reject(new Error(sanitizeText(`Comando "${execCommand}" falhou com código ${err.code ?? 1}: ${err.message}`)));
              }
            }
          );

          child.stderr?.on("data", (data) => {
            const msg = sanitizeText(data.toString().trim());
            if (msg) void log("WARNING", `[stderr] ${msg}`);
          });

          if (isAlreadyCompressed) {
            child.stdout?.pipe(writeStream);
          } else {
            const gzip = createGzip();
            child.stdout?.pipe(gzip).pipe(writeStream);
          }

          writeStream.on("finish", () => resolve());
          writeStream.on("error", (err) => reject(new Error(sanitizeText(err.message))));
        });
      }

      await log("INFO", "Dump concluído com sucesso.");

      // 3. Criptografia AES-256 e Checksum
      await updateProgress(40, "Criptografando Arquivo (AES-256)", "COMPRESSING");
      const encryptedTempFilePath = `${localTempFilePath}.enc`;
      await log("INFO", "Criptografando arquivo de backup em repouso com AES-256-CBC...");
      await encryptFile(localTempFilePath, encryptedTempFilePath);

      await updateProgress(50, "Calculando Checksum", "CHECKSUM");
      const hash = createHash("sha256");
      const fileData = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const readStream = createReadStream(encryptedTempFilePath);
        readStream.on("data", (chunk: any) => {
          hash.update(chunk);
          chunks.push(chunk);
        });
        readStream.on("end", () => resolve(Buffer.concat(chunks)));
        readStream.on("error", (err: any) => reject(err));
      });
      const checksumSha256 = hash.digest("hex");
      const fileSize = fileData.length;

      await log("INFO", `Checksum SHA-256 gerado (arquivo criptografado): ${checksumSha256} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

      // 4. Carregar conexão Google Drive e fazer upload
      await updateProgress(65, "Fazendo upload para o Google Drive", "UPLOADING");
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
      const filename = `${source.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}-${Date.now()}.sql.gz.enc`;
      
      let mainOrgFolderId: string | undefined = connection.googleDrive.rootFolderId || undefined;

      // Se nao existir rootFolderId da organizacao no Google Drive, cria/localiza a pasta da Organizacao
      if (!mainOrgFolderId) {
        const orgObj = await prisma.organization.findUnique({ where: { id: organizationId } });
        const orgName = orgObj?.name || "i7AI Cloud Backups";
        const rootItems = await drive.list("root");
        const existingOrgFolder = rootItems.find((i) => i.name === orgName);
        if (existingOrgFolder) {
          mainOrgFolderId = existingOrgFolder.id;
        } else {
          mainOrgFolderId = await drive.createFolder(orgName);
        }
        await prisma.googleDriveConnection.update({
          where: { id: connection.googleDrive.id },
          data: { rootFolderId: mainOrgFolderId },
        });
      }

      let targetDriveFolderId: string | undefined = mainOrgFolderId;
      const runSectorId = run.sectorId || source.sectorId;

      if (runSectorId) {
        const sectorObj = await prisma.sector.findUnique({ where: { id: runSectorId } });
        if (sectorObj) {
          let storageSpace = await prisma.storageSpace.findFirst({
            where: { organizationId, sectorId: runSectorId, deletedAt: null },
          });

          let sectorDriveFolderId = storageSpace?.rootFolderId;
          if (!sectorDriveFolderId) {
            const orgItems = await drive.list(mainOrgFolderId || "root");
            const existingSectorFolder = orgItems.find((i) => i.name === sectorObj.name);
            if (existingSectorFolder) {
              sectorDriveFolderId = existingSectorFolder.id;
            } else {
              sectorDriveFolderId = await drive.createFolder(sectorObj.name, mainOrgFolderId);
            }

            if (storageSpace) {
              await prisma.storageSpace.update({
                where: { id: storageSpace.id },
                data: { rootFolderId: sectorDriveFolderId },
              });
            } else {
              storageSpace = await prisma.storageSpace.create({
                data: {
                  organizationId,
                  sectorId: runSectorId,
                  name: sectorObj.name,
                  rootFolderId: sectorDriveFolderId,
                },
              });
            }
          }

          if (sectorDriveFolderId) {
            const sectorItems = await drive.list(sectorDriveFolderId);
            const existingBackupsFolder = sectorItems.find((i) => i.name === "Backups");
            if (existingBackupsFolder) {
              targetDriveFolderId = existingBackupsFolder.id;
            } else {
              targetDriveFolderId = await drive.createFolder("Backups", sectorDriveFolderId);
            }
          }
        }
      }

      await log("INFO", `Iniciando upload do backup criptografado (${filename}) para a pasta da Secretaria no Google Drive...`);
      const readableStream = createReadStream(encryptedTempFilePath);
      
      const stored = await drive.upload(
        readableStream,
        filename,
        targetDriveFolderId,
        "application/octet-stream"
      );

      await log("INFO", `Upload concluído. Google Drive File ID: ${stored.id}`);

      // Registrar arquivo de backup
      const backupFile = await prisma.backupFile.create({
        data: {
          backupRunId: runId,
          sectorId: runSectorId,
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
      const rawErrMsg = err instanceof Error ? err.message : "Erro desconhecido durante a execução.";
      const rawSecretPassword = String(config.dbPassword || "");
      const errMsg = rawSecretPassword ? rawErrMsg.replaceAll(rawSecretPassword, "[PASSWORD_REDACTED]") : rawErrMsg;
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
      // Remover arquivos temporários locais do worker
      const encPath = `${localTempFilePath}.enc`;
      const decPath = path.join(tmpDir, `backup-decrypted-${runId}.sql.gz`);
      for (const f of [localTempFilePath, encPath, decPath]) {
        try {
          if (existsSync(f)) {
            unlinkSync(f);
            console.log(`[Run ${runId}] Arquivo temporário excluído: ${path.basename(f)}`);
          }
        } catch (errUnlink) {
          console.error(`Erro ao deletar arquivo temporário ${f}:`, errUnlink);
        }
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

type ActiveCronEntry = {
  task: cron.ScheduledTask;
  fingerprint: string;
};

// Mapa de jobs de cron ativos (scheduleId -> tarefa + fingerprint)
const activeCronJobs = new Map<string, ActiveCronEntry>();

function scheduleFingerprint(schedule: {
  frequency: string;
  time: string;
  timezone: string | null;
  sources: { sourceId: string }[];
}): string {
  const sourceIds = schedule.sources.map((item) => item.sourceId).sort().join(",");
  return `${schedule.frequency}|${schedule.time}|${schedule.timezone || "America/Cuiaba"}|${sourceIds}`;
}

async function syncScheduler() {
  console.info("[Scheduler] Sincronizando agendamentos ativos...");
  try {
    const schedules = await prisma.backupSchedule.findMany({
      where: { active: true },
      include: {
        sources: {
          include: { source: { select: { id: true, name: true, organizationId: true, sectorId: true, active: true, deletedAt: true } } },
        },
      },
    });

    // Remover jobs que foram desativados ou cuja configuração mudou
    for (const [id, entry] of activeCronJobs.entries()) {
      const still = schedules.find((s: { id: string }) => s.id === id);
      if (!still || entry.fingerprint !== scheduleFingerprint(still)) {
        entry.task.stop();
        activeCronJobs.delete(id);
        console.info(`[Scheduler] Agendamento ${id} removido${still ? " para recriação" : ""}.`);
      }
    }

    // Adicionar/atualizar jobs
    for (const schedule of schedules) {
      if (activeCronJobs.has(schedule.id)) continue;

      const expression = freqToCronExpression(schedule.frequency, schedule.time);
      if (!cron.validate(expression)) {
        console.warn(`[Scheduler] Expressão cron inválida para ${schedule.name}: ${expression}`);
        continue;
      }

      const fingerprint = scheduleFingerprint(schedule);
      const task = cron.schedule(expression, async () => {
        console.info(`[Scheduler] Disparando backup agendado: ${schedule.name}`);
        for (const scheduleSource of schedule.sources) {
          const source = scheduleSource.source;
          if (!source.active || source.deletedAt) continue;

          if (source.organizationId !== schedule.organizationId) {
            console.error(`[Scheduler] Rejeitado: Organização da Origem (${source.organizationId}) difere do Agendamento (${schedule.organizationId}).`);
            continue;
          }

          const resolvedSectorId = source.sectorId || schedule.sectorId;
          if (!resolvedSectorId) {
            console.error(`[Scheduler] Rejeitado: Origem (${source.name}) ou Agendamento (${schedule.name}) sem Secretaria associada.`);
            continue;
          }

          if (source.sectorId && schedule.sectorId && source.sectorId !== schedule.sectorId) {
            console.error(`[Scheduler] Rejeitado: Inconsistência de Secretaria entre a Origem (${source.sectorId}) e o Agendamento (${schedule.sectorId}).`);
            continue;
          }

          let runId: string | null = null;
          try {
            const run = await prisma.backupRun.create({
              data: {
                organizationId: source.organizationId,
                sectorId: resolvedSectorId,
                sourceId: source.id,
                scheduleId: schedule.id,
                status: "PENDING",
                startedAt: new Date(),
              },
            });
            runId = run.id;

            await addBackupJob(run.id, source.id);
            console.info(`[Scheduler] Job de backup enfileirado com sucesso: run=${run.id} source=${source.id} sector=${resolvedSectorId}`);
          } catch (err) {
            if (runId) {
              await prisma.backupRun.update({
                where: { id: runId },
                data: {
                  status: "FAILED",
                  errorMessage: "Falha ao enfileirar job no Redis.",
                  completedAt: new Date(),
                },
              }).catch(() => undefined);
            }
            console.error(`[Scheduler] Erro ao enfileirar backup para source ${source.id}:`, err);
          }
        }
      }, {
        timezone: schedule.timezone || "America/Cuiaba",
      });

      activeCronJobs.set(schedule.id, { task, fingerprint });
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
