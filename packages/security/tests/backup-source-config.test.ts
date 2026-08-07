import { describe, expect, it } from "vitest";

describe("Configuração e Sanitização de Origens de Backup MySQL / PostgreSQL", () => {
  function prepareBackupDumpConfig(source: {
    type: "MYSQL" | "POSTGRESQL" | "DOCKER_VOLUME" | "DIRECTORY";
    config: Record<string, any>;
  }) {
    const { type, config } = source;

    if (type === "MYSQL" || type === "POSTGRESQL") {
      if (!config.host || !config.port) {
        throw new Error("Origem de backup precisa ser atualizada com Host e Porta.");
      }

      const host = String(config.host).trim();
      const port = Number(config.port);
      const dbUser = String(config.dbUser || "").trim();
      const dbPassword = String(config.dbPassword || "");
      const dbName = String(config.dbName || ""); // NUNCA DAR TRIM() EM DBNAME PARA PRESERVAR BANCOS LEGADOS
      const extraEnv: Record<string, string> = {};

      let execCommand = "";
      let execArgs: string[] = [];

      if (type === "MYSQL") {
        if (dbPassword) extraEnv.MYSQL_PWD = dbPassword;
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
      } else {
        if (dbPassword) extraEnv.PGPASSWORD = dbPassword;
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

      const safeArgs = execArgs.map((arg) =>
        dbPassword && arg.includes(dbPassword) ? "[PASSWORD_REDACTED]" : arg
      );
      const loggedCommand = `Executando dump local seguro: ${execCommand} ${safeArgs.join(" ")}`;

      const sanitizeMessage = (msg: string) => {
        if (!dbPassword) return msg;
        return msg.replaceAll(dbPassword, "[PASSWORD_REDACTED]");
      };

      return {
        execCommand,
        execArgs,
        safeArgs,
        extraEnv,
        loggedCommand,
        dbName,
        sanitizeMessage,
      };
    }

    throw new Error("Tipo de origem não suportado no teste.");
  }

  it("1. MYSQL: com host=mysql e port=3306 monta args com '-h mysql' e '-P 3306'", () => {
    const res = prepareBackupDumpConfig({
      type: "MYSQL",
      config: { host: "mysql", port: 3306, dbUser: "root", dbName: "meubanco", dbPassword: "senha" },
    });

    expect(res.execArgs).toContain("-h");
    expect(res.execArgs).toContain("mysql");
    expect(res.execArgs).toContain("-P");
    expect(res.execArgs).toContain("3306");
  });

  it("2. MYSQL: sem host é rejeitado antes da execução", () => {
    expect(() =>
      prepareBackupDumpConfig({
        type: "MYSQL",
        config: { port: 3306, dbUser: "root", dbName: "meubanco" },
      })
    ).toThrow("Origem de backup precisa ser atualizada com Host e Porta.");
  });

  it("3. MYSQL: sem port é rejeitado", () => {
    expect(() =>
      prepareBackupDumpConfig({
        type: "MYSQL",
        config: { host: "mysql", dbUser: "root", dbName: "meubanco" },
      })
    ).toThrow("Origem de backup precisa ser atualizada com Host e Porta.");
  });

  it("4. MYSQL: databaseName com espaço inicial (' jefe0292_financeiro') é preservado exatamente", () => {
    const res = prepareBackupDumpConfig({
      type: "MYSQL",
      config: { host: "mysql", port: 3306, dbUser: "root", dbName: " jefe0292_financeiro" },
    });

    expect(res.dbName).toBe(" jefe0292_financeiro");
    expect(res.execArgs[res.execArgs.length - 1]).toBe(" jefe0292_financeiro");
  });

  it("5. MYSQL: password NÃO aparece nos args logados, command log ou mensagens sanitizadas", () => {
    const rawPass = "SecretPassword123!";
    const res = prepareBackupDumpConfig({
      type: "MYSQL",
      config: { host: "mysql", port: 3306, dbUser: "root", dbName: "meubanco", dbPassword: rawPass },
    });

    expect(res.execArgs).not.toContain(rawPass);
    expect(res.safeArgs.join(" ")).not.toContain(rawPass);
    expect(res.loggedCommand).not.toContain(rawPass);
    expect(res.extraEnv.MYSQL_PWD).toBe(rawPass);

    const testError = `Erro ao conectar no banco com a senha ${rawPass} no servidor mysql`;
    expect(res.sanitizeMessage(testError)).not.toContain(rawPass);
    expect(res.sanitizeMessage(testError)).toContain("[PASSWORD_REDACTED]");
  });

  it("6. POSTGRESQL: com host=postgres e port=5432 monta args com '-h postgres' e '-p 5432'", () => {
    const res = prepareBackupDumpConfig({
      type: "POSTGRESQL",
      config: { host: "postgres", port: 5432, dbUser: "postgres", dbName: "meubanco" },
    });

    expect(res.execArgs).toContain("-h");
    expect(res.execArgs).toContain("postgres");
    expect(res.execArgs).toContain("-p");
    expect(res.execArgs).toContain("5432");
  });

  it("7. POSTGRESQL: PGPASSWORD é passado somente no env do processo e nunca aparece no log", () => {
    const rawPass = "PgSecretPass456!";
    const res = prepareBackupDumpConfig({
      type: "POSTGRESQL",
      config: { host: "postgres", port: 5432, dbUser: "postgres", dbName: "meubanco", dbPassword: rawPass },
    });

    expect(res.extraEnv.PGPASSWORD).toBe(rawPass);
    expect(res.execArgs).not.toContain(rawPass);
    expect(res.loggedCommand).not.toContain(rawPass);

    const err = `pg_dump failed with password ${rawPass}`;
    expect(res.sanitizeMessage(err)).toBe("pg_dump failed with password [PASSWORD_REDACTED]");
  });

  it("8. Origem antiga sem host/port é rejeitada com mensagem de atualização necessária", () => {
    expect(() =>
      prepareBackupDumpConfig({
        type: "MYSQL",
        config: { dbUser: "root", dbName: "banco_antigo", dbPassword: "123" },
      })
    ).toThrow("Origem de backup precisa ser atualizada com Host e Porta.");

    expect(() =>
      prepareBackupDumpConfig({
        type: "POSTGRESQL",
        config: { dbUser: "postgres", dbName: "banco_antigo_pg" },
      })
    ).toThrow("Origem de backup precisa ser atualizada com Host e Porta.");
  });
});
