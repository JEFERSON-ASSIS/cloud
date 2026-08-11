import { describe, expect, it } from "vitest";
import { resolveFilesBackTarget } from "./files-navigation";

describe("resolveFilesBackTarget", () => {
  it("não exibe destino de volta na raiz", () => {
    expect(
      resolveFilesBackTarget({
        folderId: null,
        sharedView: false,
        trash: false,
        breadcrumbs: [],
      }),
    ).toBeNull();
  });

  it("volta uma pasta por vez e depois retorna à raiz", () => {
    expect(
      resolveFilesBackTarget({
        folderId: "filha",
        sharedView: false,
        trash: false,
        breadcrumbs: [
          { id: "raiz", name: "Engenharias" },
          { id: "pai", name: "Projetos" },
          { id: "filha", name: "2026" },
        ],
      }),
    ).toEqual({ folderId: "pai", sharedView: false, trash: false });

    expect(
      resolveFilesBackTarget({
        folderId: "raiz",
        sharedView: false,
        trash: false,
        breadcrumbs: [{ id: "raiz", name: "Engenharias" }],
      }),
    ).toEqual({ folderId: null, sharedView: false, trash: false });
  });

  it("preserva o contexto compartilhado até voltar à lista compartilhada", () => {
    expect(
      resolveFilesBackTarget({
        folderId: "filha",
        sharedView: true,
        trash: false,
        breadcrumbs: [
          { id: "__shared__", name: "Compartilhados comigo" },
          { id: "raiz-compartilhada", name: "Projetos" },
          { id: "filha", name: "2026" },
        ],
      }),
    ).toEqual({ folderId: "raiz-compartilhada", sharedView: true, trash: false });

    expect(
      resolveFilesBackTarget({
        folderId: "raiz-compartilhada",
        sharedView: true,
        trash: false,
        breadcrumbs: [
          { id: "__shared__", name: "Compartilhados comigo" },
          { id: "raiz-compartilhada", name: "Projetos" },
        ],
      }),
    ).toEqual({ folderId: null, sharedView: true, trash: false });
  });

  it("volta da lista compartilhada ou da lixeira para a raiz", () => {
    expect(
      resolveFilesBackTarget({
        folderId: null,
        sharedView: true,
        trash: false,
        breadcrumbs: [{ id: "__shared__", name: "Compartilhados comigo" }],
      }),
    ).toEqual({ folderId: null, sharedView: false, trash: false });

    expect(
      resolveFilesBackTarget({
        folderId: null,
        sharedView: false,
        trash: true,
        breadcrumbs: [],
      }),
    ).toEqual({ folderId: null, sharedView: false, trash: false });
  });
});
