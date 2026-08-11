import { describe, expect, it } from "vitest";
import { updateProfileSchema } from "./profile";

describe("updateProfileSchema", () => {
  it("permite atualizar somente o nome", () => {
    expect(updateProfileSchema.parse({ name: "Maria Silva" }).name).toBe("Maria Silva");
  });

  it("exige senha atual e confirmação para trocar a senha", () => {
    const result = updateProfileSchema.safeParse({
      name: "Maria Silva",
      newPassword: "nova-senha-segura",
      confirmPassword: "diferente",
    });
    expect(result.success).toBe(false);
  });

  it("aceita uma troca de senha completa", () => {
    expect(
      updateProfileSchema.safeParse({
        name: "Maria Silva",
        currentPassword: "senha-atual",
        newPassword: "nova-senha-segura",
        confirmPassword: "nova-senha-segura",
      }).success,
    ).toBe(true);
  });
});
