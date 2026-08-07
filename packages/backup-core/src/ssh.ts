import { createReadStream } from "node:fs";
import { Client, type ConnectConfig } from "ssh2";

export interface SshConfig {
  host: string;
  port: number;
  username: string;
  password?: string | null;
  privateKey?: string | null;
}

export function testSshConnection(config: SshConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const opts: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 10000,
    };
    if (config.password) opts.password = config.password;
    if (config.privateKey) opts.privateKey = config.privateKey;

    conn
      .on("ready", () => {
        conn.end();
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      })
      .connect(opts);
  });
}

export function executeSshCommandWithInput(
  config: SshConfig,
  command: string,
  inputFilePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const opts: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 15_000,
    };
    if (config.password) opts.password = config.password;
    if (config.privateKey) opts.privateKey = config.privateKey;

    const fail = (error: Error) => {
      conn.end();
      reject(error);
    };

    conn
      .once("ready", () => {
        conn.exec(command, (error, stream) => {
          if (error) return fail(error);
          let stderr = "";
          stream.stderr.on("data", (chunk: Buffer) => {
            if (stderr.length < 8_192) stderr += chunk.toString("utf8");
          });
          stream.once("error", fail);
          stream.once("close", (code: number | null) => {
            conn.end();
            if (code === 0) resolve();
            else reject(new Error(`Comando remoto falhou com código ${code ?? "desconhecido"}: ${stderr.trim().slice(0, 2_000)}`));
          });
          const input = createReadStream(inputFilePath);
          input.once("error", fail);
          input.pipe(stream);
        });
      })
      .once("error", reject)
      .connect(opts);
  });
}
