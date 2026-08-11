import { describe, expect, it } from "vitest";
import {
  assignableMenuKeys,
  menuKeysFromPermissions,
  navItemDefinitions,
} from "./nav-items";

describe("menu Meu perfil", () => {
  it("permanece visível sem depender das permissões administrativas", () => {
    expect(menuKeysFromPermissions([])).toContain("perfil");
    expect(navItemDefinitions.find((item) => item.key === "perfil")?.alwaysVisible).toBe(true);
  });

  it("não permite que a configuração de perfis remova o menu pessoal", () => {
    expect(assignableMenuKeys()).not.toContain("perfil");
  });
});
