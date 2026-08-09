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

  it("renova o token e tenta de novo após 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("expirado", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { emailAddress: "a@b.com" } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn().mockResolvedValue("novo-token");
    const provider = new GoogleDriveStorageProvider("velho", onUnauthorized);
    await expect(provider.testConnection()).resolves.toBe(true);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer novo-token",
    });
  });
});
