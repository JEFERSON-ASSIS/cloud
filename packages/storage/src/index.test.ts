import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleDriveStorageProvider } from "./index";

describe("GoogleDriveStorageProvider", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("envia bearer token e interpreta a quota", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ storageQuota: { usage: "1024", limit: "4096" } }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GoogleDriveStorageProvider("segredo");
    await expect(provider.getQuota()).resolves.toEqual({
      used: 1024,
      limit: 4096,
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer segredo",
    });
  });
  it("não considera erro remoto como sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("negado", { status: 401 })),
    );
    await expect(
      new GoogleDriveStorageProvider("inválido").testConnection(),
    ).rejects.toThrow("401");
  });
});
