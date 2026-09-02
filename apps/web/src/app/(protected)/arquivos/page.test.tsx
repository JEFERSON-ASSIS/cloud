import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveTenantContext } from "@/components/AppShell/ActiveTenantContext";
import FilesPage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const emptyListing = {
  breadcrumbs: [],
  folders: [],
  documents: [],
};

function tenantValue(activeSectorId: string) {
  return {
    organizations: [{ id: "prefeitura-1", name: "Prefeitura" }],
    sectors: [
      { id: "engenharias-1", name: "Engenharias" },
      { id: "cultura-1", name: "Cultura" },
    ],
    activeOrganizationId: "prefeitura-1",
    activeSectorId,
    setActiveOrganizationId: vi.fn(),
    setActiveSectorId: vi.fn(),
  };
}

function renderFilesPage(activeSectorId: string) {
  return render(
    <ActiveTenantContext.Provider value={tenantValue(activeSectorId)}>
      <FilesPage />
    </ActiveTenantContext.Provider>,
  );
}

afterEach(() => {
  // sem isto a árvore de um teste continua montada e duplica os elementos
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FilesPage tenant hydration", () => {
  it("nunca consulta nem mantém pastas visíveis sem a secretaria ativa", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...emptyListing,
        folders: [
          {
            id: "engenharias-folder",
            name: "Engenharias",
            kind: "folder",
            parentId: null,
          },
        ],
      }),
    } as Response);

    const view = renderFilesPage("");

    await act(async () => vi.runOnlyPendingTimers());
    expect(screen.queryByText("Engenharias")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.useRealTimers();

    view.rerender(
      <ActiveTenantContext.Provider value={tenantValue("engenharias-1")}>
        <FilesPage />
      </ActiveTenantContext.Provider>,
    );

    expect(await screen.findByText("Engenharias")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/files?organizationId=prefeitura-1&sectorId=engenharias-1",
    );

    let resolveCulture!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveCulture = resolve; }),
    );

    view.rerender(
      <ActiveTenantContext.Provider value={tenantValue("cultura-1")}>
        <FilesPage />
      </ActiveTenantContext.Provider>,
    );

    expect(screen.queryByText("Engenharias")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveCulture({
        ok: true,
        json: async () => emptyListing,
      } as Response);
    });
  });
});

function folderFile(name: string, relativePath: string): File {
  const file = new File(["conteudo"], name, { type: "text/plain" });
  Object.defineProperty(file, "webkitRelativePath", {
    value: relativePath,
    configurable: true,
  });
  return file;
}

describe("FilesPage envio de pastas", () => {
  it("recria a arvore da pasta enviada reaproveitando a pasta ja existente", async () => {
    // A secretaria abre em "Engenharias"; dentro dela já existe "Contratos",
    // que o envio deve reaproveitar em vez de duplicar.
    const rootListing = {
      ...emptyListing,
      breadcrumbs: [{ id: "engenharias-folder", name: "Engenharias" }],
      folders: [{ id: "engenharias-folder", name: "Engenharias", kind: "folder" }],
    };
    const sectorListing = {
      ...emptyListing,
      breadcrumbs: [{ id: "engenharias-folder", name: "Engenharias" }],
      folders: [{ id: "contratos-1", name: "Contratos", kind: "folder" }],
    };
    const createdFolders: Array<{ name: string; parentId: string }> = [];
    const uploadedTo: string[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/files")) {
          const target = new URL(url, "http://localhost").searchParams.get("folderId");
          const listing =
            target === "engenharias-folder"
              ? sectorListing
              : target
                ? emptyListing
                : rootListing;
          return { ok: true, json: async () => listing } as Response;
        }
        if (url.startsWith("/api/folders")) {
          const body = JSON.parse(String(init?.body)) as {
            name: string;
            parentId: string;
          };
          createdFolders.push({ name: body.name, parentId: body.parentId });
          return {
            ok: true,
            json: async () => ({ id: `criada-${body.name}` }),
          } as Response;
        }
        if (url.startsWith("/api/documents/uploads")) {
          if (url.includes("/complete")) {
            return { ok: true, json: async () => ({ complete: true }) } as Response;
          }
          const body = JSON.parse(String(init?.body ?? "{}")) as { folderId?: string };
          if (body.folderId) uploadedTo.push(body.folderId);
          return {
            ok: true,
            json: async () => ({
              uploadId: `upload-${uploadedTo.length}`,
              chunkSize: 1024,
              // já enviado: o teste cobre o destino, não o envio dos bytes
              uploadedBytes: 8,
            }),
          } as Response;
        }
        throw new Error(`fetch inesperado: ${url}`);
      },
    );

    renderFilesPage("engenharias-1");
    // o seletor de pasta só existe dentro de uma pasta aberta
    // "Engenharias" aparece na trilha e no cartão; o cartão é o P, não o botão.
    const sectorFolder = (await screen.findAllByText("Engenharias")).find(
      (node) => node.tagName === "P",
    )!;
    await act(async () => {
      fireEvent.doubleClick(sectorFolder);
    });
    await screen.findByRole("button", { name: "Enviar pasta" });

    const folderPicker = document
      .querySelectorAll<HTMLInputElement>('input[type="file"]')
      .item(1);
    Object.defineProperty(folderPicker, "files", {
      value: [
        folderFile("ata.pdf", "Contratos/2025/ata.pdf"),
        folderFile("capa.png", "Contratos/capa.png"),
      ],
      configurable: true,
    });

    await act(async () => {
      folderPicker.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => expect(uploadedTo).toHaveLength(2));
    expect(createdFolders).toEqual([{ name: "2025", parentId: "contratos-1" }]);
    expect(uploadedTo).toEqual(["criada-2025", "contratos-1"]);
    expect(createdFolders).not.toContainEqual(
      expect.objectContaining({ name: "Contratos" }),
    );
  });
});

describe("FilesPage exclusao em lote", () => {
  const listingComItens = {
    ...emptyListing,
    breadcrumbs: [{ id: "engenharias-folder", name: "Engenharias" }],
    folders: [{ id: "pasta-1", name: "Relatorios", kind: "folder" }],
    documents: [
      { id: "doc-1", name: "ata.pdf", kind: "document", size: "1024" },
      { id: "doc-2", name: "oficio.pdf", kind: "document", size: "2048" },
    ],
  };

  function mockListing(listing: unknown) {
    const patched: Array<{ url: string; action: string }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "PATCH") {
          const body = JSON.parse(String(init.body)) as { action: string };
          patched.push({ url, action: body.action });
          return { ok: true, json: async () => ({}) } as Response;
        }
        // dentro de qualquer subpasta a listagem é vazia, para os nomes
        // não aparecerem duas vezes ao navegar
        const target = new URL(url, "http://localhost").searchParams.get("folderId");
        return {
          ok: true,
          json: async () => (target === "pasta-1" ? emptyListing : listing),
        } as Response;
      },
    );
    return patched;
  }

  async function selecionar(nome: string) {
    const linha = screen
      .getAllByText(nome)
      .map((node) => node.closest(".MuiCard-root"))
      .find(Boolean)!;
    const checkbox = linha.querySelector('input[type="checkbox"]')!;
    await act(async () => {
      fireEvent.click(checkbox);
    });
  }

  it("envia um PATCH de lixeira para cada item selecionado e nenhum para os demais", async () => {
    const patched = mockListing(listingComItens);
    renderFilesPage("engenharias-1");
    await screen.findAllByText("ata.pdf");

    await selecionar("ata.pdf");
    await selecionar("Relatorios");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mover para a lixeira" }));
    });

    await waitFor(() => expect(patched).toHaveLength(2));
    expect(patched.map((p) => p.url).sort()).toEqual([
      "/api/documents/doc-1",
      "/api/folders/pasta-1",
    ]);
    expect(patched.every((p) => p.action === "trash")).toBe(true);
  });

  it("mostra quantos itens estao selecionados", async () => {
    mockListing(listingComItens);
    renderFilesPage("engenharias-1");
    await screen.findAllByText("ata.pdf");

    await selecionar("ata.pdf");
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();

    await selecionar("oficio.pdf");
    expect(screen.getByText("2 selecionados")).toBeInTheDocument();
  });

  it("descarta a selecao ao navegar, mesmo se a pasta destino repetir o item", async () => {
    // O destino contém um documento com o MESMO id do que foi selecionado:
    // sem limpar a seleção, ele apareceria marcado sem o usuário ter pedido.
    const destino = {
      ...emptyListing,
      breadcrumbs: [
        { id: "engenharias-folder", name: "Engenharias" },
        { id: "pasta-1", name: "Relatorios" },
      ],
      documents: [{ id: "doc-1", name: "ata.pdf", kind: "document", size: "1024" }],
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL) => {
        const target = new URL(String(input), "http://localhost").searchParams.get(
          "folderId",
        );
        return {
          ok: true,
          json: async () => (target === "pasta-1" ? destino : listingComItens),
        } as Response;
      },
    );

    renderFilesPage("engenharias-1");
    await screen.findAllByText("ata.pdf");

    await selecionar("ata.pdf");
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();

    await act(async () => {
      fireEvent.doubleClick(screen.getAllByText("Relatorios")[0]!);
    });
    await screen.findAllByText("ata.pdf");

    expect(screen.queryByText("1 selecionado")).not.toBeInTheDocument();
  });

  it("relata falha parcial sem interromper os outros itens", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "PATCH") {
          if (url.includes("doc-1")) {
            return {
              ok: false,
              json: async () => ({ error: "Sem permissão." }),
            } as Response;
          }
          return { ok: true, json: async () => ({}) } as Response;
        }
        return { ok: true, json: async () => listingComItens } as Response;
      },
    );

    renderFilesPage("engenharias-1");
    await screen.findAllByText("ata.pdf");

    await selecionar("ata.pdf");
    await selecionar("oficio.pdf");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mover para a lixeira" }));
    });

    expect(
      await screen.findByText(/1 de 2 itens não foram excluídos/),
    ).toBeInTheDocument();
  });
});
