import { describe, expect, it } from "vitest";
import { buildScopedFoldersUrl } from "./folders-scope";

describe("buildScopedFoldersUrl", () => {
  it("não permite listar pastas sem uma secretaria selecionada", () => {
    expect(buildScopedFoldersUrl("prefeitura-1", "")).toBeNull();
  });

  it("envia organização e secretaria na listagem administrativa", () => {
    expect(buildScopedFoldersUrl("prefeitura-1", "engenharias-1")).toBe(
      "/api/files?allFolders=1&sectorId=engenharias-1&organizationId=prefeitura-1",
    );
  });
});
