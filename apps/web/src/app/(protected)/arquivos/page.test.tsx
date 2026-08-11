import { act, render, screen, waitFor } from "@testing-library/react";
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
