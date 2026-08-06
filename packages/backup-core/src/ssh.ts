import { Client } from "ssh2";

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
    const opts: any = {
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
