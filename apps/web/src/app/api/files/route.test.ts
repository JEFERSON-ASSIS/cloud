import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireTenantOrganization } = vi.hoisted(() => ({
  requireTenantOrganization: vi.fn(),
}));

vi.mock("@i7ai/database", () => ({ prisma: {} }));
vi.mock("@/server/tenant", () => ({ requireTenantOrganization }));

import { GET } from "./route";

describe("GET /api/files", () => {
  beforeEach(() => {
    requireTenantOrganization.mockResolvedValue({
      tenant: {
        userId: "admin-1",
        role: "ADMIN",
        organizationId: "prefeitura-1",
        permissions: ["document.read"],
      },
      organizationId: "prefeitura-1",
    });
  });

  it("recusa inclusive administrador quando a secretaria não foi informada", async () => {
    const response = await GET(new Request("http://localhost/api/files"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Selecione uma secretaria para listar os arquivos.",
    });
  });
});
