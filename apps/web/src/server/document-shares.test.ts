import { describe, expect, it } from "vitest";
import {
  sectorRoleWeight,
  sharePermissionAllowsDownload,
  shareRecipientFilter,
} from "./document-shares";

describe("regras de compartilhamento de documentos", () => {
  it("mantém a hierarquia de acesso das secretarias", () => {
    expect(sectorRoleWeight("ADMIN")).toBeGreaterThan(sectorRoleWeight("EDITOR"));
    expect(sectorRoleWeight("EDITOR")).toBeGreaterThan(
      sectorRoleWeight("VIEWER_DOWNLOAD"),
    );
    expect(sectorRoleWeight("VIEWER_ONLY")).toBeGreaterThan(
      sectorRoleWeight("NO_ACCESS"),
    );
  });

  it("permite download somente quando concedido explicitamente", () => {
    expect(sharePermissionAllowsDownload("VIEW")).toBe(false);
    expect(sharePermissionAllowsDownload("DOWNLOAD")).toBe(true);
  });

  it("restringe o compartilhamento individual ao destinatário", () => {
    expect(shareRecipientFilter("user-1", false)).toEqual({
      OR: [{ targetUserId: null }, { targetUserId: "user-1" }],
    });
    expect(shareRecipientFilter("admin", true)).toEqual({});
  });
});
