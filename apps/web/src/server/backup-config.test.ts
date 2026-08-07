import { describe, expect, it } from "vitest";
import { hasBackupSecrets, mergeBackupConfig, sanitizeBackupConfig } from "./backup-config";

describe("configuração segura de backup", () => {
  it("nunca devolve senhas, tokens ou chaves", () => {
    const safe = sanitizeBackupConfig({ host: "db", dbUser: "app", dbPassword: "segredo", accessToken: "token" });
    expect(safe).toEqual({ host: "db", dbUser: "app" });
  });

  it("preserva segredo existente quando o formulário envia vazio", () => {
    expect(mergeBackupConfig({ dbPassword: "atual" }, { dbPassword: "", host: "novo" }))
      .toEqual({ dbPassword: "atual", host: "novo" });
  });

  it("informa apenas que existe segredo", () => {
    expect(hasBackupSecrets({ dbPassword: "segredo" })).toBe(true);
  });
});
