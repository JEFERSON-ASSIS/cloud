import { describe, expect, it } from "vitest";
import { cleanName } from "./documents";

describe("segurança dos nomes de documentos", () => {
  it("remove separadores e caracteres de controle", () => {
    expect(cleanName("relatório/2026\\final.pdf")).toBe(
      "relatório 2026 final.pdf",
    );
  });
  it("recusa nomes vazios e segmentos de travessia", () => {
    expect(() => cleanName("..")).toThrow("Nome inválido");
    expect(() => cleanName("\u0000")).toThrow("Nome inválido");
  });
});
