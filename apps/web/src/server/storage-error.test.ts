import { describe, expect, it } from "vitest";
import { StorageProviderError } from "@i7ai/storage";
import { userFacingStorageError } from "./storage-error";

describe("userFacingStorageError", () => {
  it("oculta o provedor de usuários comuns", () => {
    const result = userFacingStorageError(
      new StorageProviderError("Google Drive respondeu 403: token inválido", 403),
      "USER",
    );
    expect(result).toContain("armazenamento em nuvem");
    expect(result).not.toMatch(/google|drive|token/i);
  });

  it("mantém detalhes técnicos para SUPER_ADMIN", () => {
    expect(
      userFacingStorageError(
        new StorageProviderError("Google Drive respondeu 403", 403),
        "SUPER_ADMIN",
      ),
    ).toBe("Google Drive respondeu 403");
  });

  it("preserva mensagens de negócio", () => {
    expect(
      userFacingStorageError(
        new Error("Quota de armazenamento da secretaria excedida."),
        "USER",
      ),
    ).toBe("Quota de armazenamento da secretaria excedida.");
  });
});
