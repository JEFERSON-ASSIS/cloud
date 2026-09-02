import { describe, expect, it, vi } from "vitest";
import { createFolderResolver } from "./upload-folder-resolver";

type Listing = { folders: Array<{ id: string; name: string }> };

function resolverWith(options: {
  listings?: Record<string, Listing>;
  created?: Record<string, string>;
  onCreateError?: (name: string) => string | undefined;
}) {
  const listFolders = vi.fn(
    async (parentId: string) => options.listings?.[parentId] ?? { folders: [] },
  );
  const createFolder = vi.fn(async (name: string, parentId: string) => {
    const failure = options.onCreateError?.(name);
    if (failure) throw new Error(failure);
    return options.created?.[`${parentId}/${name}`] ?? `new-${parentId}-${name}`;
  });
  return {
    listFolders,
    createFolder,
    resolve: createFolderResolver({
      rootFolderId: "root",
      listFolders: (parentId) => listFolders(parentId),
      createFolder: (name, parentId) => createFolder(name, parentId),
    }),
  };
}

describe("createFolderResolver", () => {
  it("reaproveita a pasta existente no destino em vez de criar outra", async () => {
    const { resolve, createFolder } = resolverWith({
      listings: { root: { folders: [{ id: "contratos-1", name: "Contratos" }] } },
    });

    await expect(resolve(["Contratos"])).resolves.toBe("contratos-1");
    expect(createFolder).not.toHaveBeenCalled();
  });

  it("cria a pasta quando nao existe nenhuma com o mesmo nome", async () => {
    const { resolve, createFolder } = resolverWith({
      created: { "root/Contratos": "contratos-novo" },
    });

    await expect(resolve(["Contratos"])).resolves.toBe("contratos-novo");
    expect(createFolder).toHaveBeenCalledWith("Contratos", "root");
  });

  it("compara nomes ignorando caixa e acentuacao inconsistente", async () => {
    const { resolve, createFolder } = resolverWith({
      listings: { root: { folders: [{ id: "contratos-1", name: "CONTRATOS" }] } },
    });

    await expect(resolve(["contratos"])).resolves.toBe("contratos-1");
    expect(createFolder).not.toHaveBeenCalled();
  });

  it("reaproveita pasta cujo nome o servidor higienizou", async () => {
    const { resolve, createFolder } = resolverWith({
      listings: { root: { folders: [{ id: "periodo-1", name: "2025 26" }] } },
    });

    await expect(resolve(["2025/26"])).resolves.toBe("periodo-1");
    expect(createFolder).not.toHaveBeenCalled();
  });

  it("preserva digitos, hifens e pontuacao ao comparar nomes", async () => {
    const { resolve, createFolder } = resolverWith({
      listings: {
        root: {
          folders: [
            { id: "obras-1", name: "Obras (2024)" },
            { id: "atas-1", name: "Ata nº 5" },
          ],
        },
      },
    });

    await expect(resolve(["Obras (2024)"])).resolves.toBe("obras-1");
    await expect(resolve(["Ata nº 5"])).resolves.toBe("atas-1");
    expect(createFolder).not.toHaveBeenCalled();
  });

  it("nao confunde pastas distintas que so diferem nos digitos", async () => {
    const { resolve, createFolder } = resolverWith({
      listings: { root: { folders: [{ id: "ano-2024", name: "Contratos 2024" }] } },
      created: { "root/Contratos 2025": "ano-2025" },
    });

    await expect(resolve(["Contratos 2025"])).resolves.toBe("ano-2025");
    expect(createFolder).toHaveBeenCalledWith("Contratos 2025", "root");
  });

  it("resolve caminhos aninhados encadeando o pai criado", async () => {
    const { resolve, createFolder } = resolverWith({
      created: {
        "root/Contratos": "contratos-1",
        "contratos-1/2025": "ano-1",
      },
    });

    await expect(resolve(["Contratos", "2025"])).resolves.toBe("ano-1");
    expect(createFolder).toHaveBeenNthCalledWith(1, "Contratos", "root");
    expect(createFolder).toHaveBeenNthCalledWith(2, "2025", "contratos-1");
  });

  it("consulta e cria cada pasta uma unica vez mesmo com varias chamadas", async () => {
    const { resolve, listFolders, createFolder } = resolverWith({
      created: { "root/Contratos": "contratos-1" },
    });

    await resolve(["Contratos"]);
    await resolve(["Contratos"]);

    expect(listFolders).toHaveBeenCalledTimes(1);
    expect(createFolder).toHaveBeenCalledTimes(1);
  });

  it("devolve a pasta atual para caminho vazio sem consultar a api", async () => {
    const { resolve, listFolders } = resolverWith({});

    await expect(resolve([])).resolves.toBe("root");
    expect(listFolders).not.toHaveBeenCalled();
  });

  it("propaga o erro da criacao sem consultar o servidor de novo", async () => {
    const { resolve, createFolder } = resolverWith({
      onCreateError: (name) => (name === "Contratos" ? "Sem permissão." : undefined),
    });

    await expect(resolve(["Contratos"])).rejects.toThrow("Sem permissão.");
    await expect(resolve(["Contratos", "2025"])).rejects.toThrow("Sem permissão.");
    expect(createFolder).toHaveBeenCalledTimes(1);
  });
});
