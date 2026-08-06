import { describe, expect, it } from "vitest";
import { AuthorizationError, authorizeTenant } from "../src/index";

describe("autorização multiempresa", () => {
  it("permite acesso quando empresa e permissão correspondem", () => {
    expect(() =>
      authorizeTenant(
        {
          userId: "u1",
          organizationId: "org-a",
          role: "VIEWER",
          permissions: ["dashboard.read"],
        },
        "org-a",
        "dashboard.read",
      ),
    ).not.toThrow();
  });
  it("nega acesso cruzado mesmo com a permissão funcional", () => {
    expect(() =>
      authorizeTenant(
        {
          userId: "u1",
          organizationId: "org-a",
          role: "ADMIN",
          permissions: ["user.read"],
        },
        "org-b",
        "user.read",
      ),
    ).toThrow(AuthorizationError);
  });
  it("permite ao superadministrador operar entre empresas", () => {
    expect(() =>
      authorizeTenant(
        {
          userId: "root",
          organizationId: null,
          role: "SUPER_ADMIN",
          permissions: [],
        },
        "org-b",
        "organization.manage",
      ),
    ).not.toThrow();
  });
});

import { assertSectorPermission, hasSectorPermission } from "../src/index";

describe("autorização por secretaria (Fase 2.1)", () => {
  it("valida papel de secretaria adequadamente", () => {
    expect(hasSectorPermission("EDITOR", "VIEWER_ONLY")).toBe(true);
    expect(hasSectorPermission("VIEWER_ONLY", "EDITOR")).toBe(false);
    expect(hasSectorPermission(null, "VIEWER_DOWNLOAD")).toBe(false);
  });

  it("permite acesso se for administrador da organização ou superadmin mesmo sem papel no setor", () => {
    expect(() => assertSectorPermission(null, "ADMIN", true)).not.toThrow();
    expect(() => assertSectorPermission("VIEWER_ONLY", "ADMIN", true)).not.toThrow();
  });

  it("bloqueia acesso sem papel adequado", () => {
    expect(() => assertSectorPermission("VIEWER_ONLY", "EDITOR", false)).toThrow(AuthorizationError);
    expect(() => assertSectorPermission("EDITOR", "ADMIN", false)).toThrow(AuthorizationError);
  });
});

