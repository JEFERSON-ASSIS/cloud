import { describe, expect, it } from "vitest";
import {
  canAssignOrganizationRole,
  resolveManagedOrganizationId,
  shouldDeactivateUser,
} from "./user-memberships";

describe("regras de vínculos de usuários", () => {
  it("impede administrador local de conceder Super Administrador", () => {
    expect(canAssignOrganizationRole("ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(canAssignOrganizationRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });

  it("ignora empresa arbitrária para usuário que não é Super Administrador", () => {
    expect(resolveManagedOrganizationId({
      actorRole: "ADMIN",
      sessionOrganizationId: "empresa-a",
      requestedOrganizationId: "empresa-b",
    })).toBe("empresa-a");
  });

  it("aceita empresa solicitada apenas para Super Administrador", () => {
    expect(resolveManagedOrganizationId({
      actorRole: "SUPER_ADMIN",
      sessionOrganizationId: "empresa-a",
      requestedOrganizationId: "empresa-b",
    })).toBe("empresa-b");
  });

  it("mantém a conta ativa enquanto existir outro vínculo empresarial", () => {
    expect(shouldDeactivateUser(1)).toBe(false);
    expect(shouldDeactivateUser(0)).toBe(true);
  });
});
