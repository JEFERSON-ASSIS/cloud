import { describe, expect, it } from "vitest";
import {
  isSelectable,
  selectionKey,
  selectableKeys,
  toggleSelection,
  toggleSelectAll,
  type SelectableItem,
} from "./files-selection";

function item(partial: Partial<SelectableItem> & { id: string }): SelectableItem {
  return { kind: "document", ...partial };
}

describe("selectionKey", () => {
  it("separa pasta e documento que compartilham o mesmo id", () => {
    expect(selectionKey({ id: "abc", kind: "folder" })).not.toBe(
      selectionKey({ id: "abc", kind: "document" }),
    );
  });
});

describe("isSelectable", () => {
  it("aceita pasta e documento comuns", () => {
    expect(isSelectable(item({ id: "a" }), false)).toBe(true);
    expect(isSelectable(item({ id: "b", kind: "folder" }), false)).toBe(true);
  });

  it("recusa item compartilhado por outra secretaria", () => {
    expect(isSelectable(item({ id: "a", shared: true }), false)).toBe(false);
  });

  it("recusa a pasta virtual de compartilhados", () => {
    expect(isSelectable(item({ id: "a", virtual: true }), false)).toBe(false);
  });

  it("recusa qualquer item quando a listagem e somente leitura", () => {
    expect(isSelectable(item({ id: "a" }), true)).toBe(false);
  });
});

describe("toggleSelection", () => {
  it("marca um item que ainda nao estava selecionado", () => {
    expect([...toggleSelection(new Set(), "document-a")]).toEqual(["document-a"]);
  });

  it("desmarca um item ja selecionado", () => {
    expect([...toggleSelection(new Set(["document-a"]), "document-a")]).toEqual([]);
  });

  it("nao altera o conjunto original", () => {
    const original = new Set(["document-a"]);
    toggleSelection(original, "document-b");
    expect([...original]).toEqual(["document-a"]);
  });
});

describe("selectableKeys", () => {
  it("ignora itens compartilhados e virtuais", () => {
    const keys = selectableKeys(
      [
        item({ id: "a" }),
        item({ id: "b", shared: true }),
        item({ id: "c", virtual: true }),
        item({ id: "d", kind: "folder" }),
      ],
      false,
    );

    expect(keys).toEqual(["document-a", "folder-d"]);
  });
});

describe("toggleSelectAll", () => {
  const items = [item({ id: "a" }), item({ id: "b" }), item({ id: "c", shared: true })];

  it("seleciona todos os itens selecionaveis quando nada esta marcado", () => {
    expect([...toggleSelectAll(new Set(), items, false)]).toEqual([
      "document-a",
      "document-b",
    ]);
  });

  it("limpa a selecao quando todos os selecionaveis ja estao marcados", () => {
    const all = new Set(["document-a", "document-b"]);
    expect([...toggleSelectAll(all, items, false)]).toEqual([]);
  });

  it("completa a selecao quando apenas parte esta marcada", () => {
    const partial = new Set(["document-a"]);
    expect([...toggleSelectAll(partial, items, false)]).toEqual([
      "document-a",
      "document-b",
    ]);
  });

  it("nunca marca item compartilhado", () => {
    expect([...toggleSelectAll(new Set(), items, false)]).not.toContain("document-c");
  });
});
