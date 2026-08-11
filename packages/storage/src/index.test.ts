import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GoogleDriveStorageProvider,
  parseGoogleUploadedBytes,
} from "./index";

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
  it("inicia uma sessão resumível com tamanho e tipo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { location: "https://upload.example/session" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GoogleDriveStorageProvider("segredo");
    await expect(
      provider.startResumableUpload(
        "Projeto.rvt",
        500_000_000,
        "pasta",
        "application/octet-stream",
      ),
    ).resolves.toBe("https://upload.example/session");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "X-Upload-Content-Length": "500000000",
      }),
    });
  });

  it("interpreta o deslocamento confirmado pelo Google", () => {
    expect(parseGoogleUploadedBytes(null)).toBe(0);
    expect(parseGoogleUploadedBytes("bytes=0-8388607")).toBe(8_388_608);
    expect(parseGoogleUploadedBytes("inválido")).toBe(0);
  });

  it("envia um bloco sem carregar o arquivo completo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 308,
        headers: { range: "bytes=0-8388607" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GoogleDriveStorageProvider("segredo");
    const block = new Uint8Array(8 * 1024 * 1024);
    await expect(
      provider.uploadResumableChunk(
        "https://upload.example/session",
        block,
        0,
        10_000_000,
      ),
    ).resolves.toEqual({ complete: false, uploadedBytes: 8_388_608 });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      headers: expect.objectContaining({
        "Content-Length": "8388608",
        "Content-Range": "bytes 0-8388607/10000000",
      }),
    });
  });

  it("reconhece a conclusão e preserva os metadados do arquivo único", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "arquivo-google",
            name: "Projeto.rvt",
            size: "500000000",
            mimeType: "application/octet-stream",
            md5Checksum: "abc123",
          }),
          { status: 200 },
        ),
      ),
    );
    const provider = new GoogleDriveStorageProvider("segredo");
    await expect(
      provider.uploadResumableChunk(
        "https://upload.example/session",
        new Uint8Array(32),
        499_999_968,
        500_000_000,
      ),
    ).resolves.toEqual({
      complete: true,
      uploadedBytes: 500_000_000,
      object: {
        id: "arquivo-google",
        name: "Projeto.rvt",
        size: 500_000_000,
        mimeType: "application/octet-stream",
        checksum: "abc123",
      },
    });
  });
});
