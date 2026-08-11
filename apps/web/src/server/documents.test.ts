import { describe, expect, it } from "vitest";
import { cleanName, requireFolderDestinationId } from "./documents";

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

describe("destino obrigatório de documentos", () => {
  it("exige que o usuário entre na pasta da secretaria", () => {
    expect(() => requireFolderDestinationId(null)).toThrow(
      "Abra a pasta da secretaria",
    );
    expect(() => requireFolderDestinationId(undefined)).toThrow(
      "Abra a pasta da secretaria",
    );
  });

  it("aceita uma pasta selecionada", () => {
    expect(requireFolderDestinationId("pasta-da-secretaria")).toBe(
      "pasta-da-secretaria",
    );
  });
});
