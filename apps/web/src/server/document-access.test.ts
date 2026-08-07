import { describe, expect, it } from "vitest";
import {
  canManageDocuments,
  defaultSectorRoleForOrgRole,
} from "./document-access";

describe("canManageDocuments", () => {
  it("libera SUPER_ADMIN e ADMIN", () => {
    expect(canManageDocuments({ role: "SUPER_ADMIN", permissions: [] })).toBe(true);
    expect(canManageDocuments({ role: "ADMIN", permissions: [] })).toBe(true);
  });

  it("libera quem tem document.read ou document.manage", () => {
    expect(
      canManageDocuments({ role: "VIEWER", permissions: ["document.read"] }),
    ).toBe(true);
    expect(
      canManageDocuments({ role: "OPERATOR", permissions: ["document.manage"] }),
    ).toBe(true);
  });

  it("bloqueia sem permissão de documento", () => {
    expect(
      canManageDocuments({ role: "VIEWER", permissions: ["dashboard.read"] }),
    ).toBe(false);
  });
});

describe("defaultSectorRoleForOrgRole", () => {
  it("VIEWER fica VIEWER_DOWNLOAD; demais EDITOR", () => {
    expect(defaultSectorRoleForOrgRole("VIEWER")).toBe("VIEWER_DOWNLOAD");
    expect(defaultSectorRoleForOrgRole("OPERATOR")).toBe("EDITOR");
    expect(defaultSectorRoleForOrgRole("MANAGER")).toBe("EDITOR");
  });
});
