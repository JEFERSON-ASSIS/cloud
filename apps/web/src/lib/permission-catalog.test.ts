import { describe, expect, it } from "vitest";
import { permissions } from "@i7ai/types";
import {
  assignablePermissionKeys,
  isPermissionKey,
  permissionCatalog,
} from "./permission-catalog";

describe("permission-catalog", () => {
  it("cobre todas as permissões do domínio", () => {
    const keys = permissionCatalog.map((item) => item.key).sort();
    expect(keys).toEqual([...permissions].sort());
  });

  it("valida chaves conhecidas", () => {
    expect(isPermissionKey("document.read")).toBe(true);
    expect(isPermissionKey("document.delete")).toBe(false);
    expect(assignablePermissionKeys()).toContain("user.manage");
  });
});
