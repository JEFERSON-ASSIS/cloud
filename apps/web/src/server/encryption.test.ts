import { beforeAll, describe, expect, it } from "vitest";

describe("criptografia de tokens", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });
  it("usa conteúdo autenticado e não expõe o token", async () => {
    const { encryptSecret, decryptSecret } = await import("./encryption");
    const encrypted = encryptSecret("token-secreto");
    expect(encrypted).not.toContain("token-secreto");
    expect(decryptSecret(encrypted)).toBe("token-secreto");
    expect(() => decryptSecret(encrypted.replace("v1.", "v2."))).toThrow();
  });
});
