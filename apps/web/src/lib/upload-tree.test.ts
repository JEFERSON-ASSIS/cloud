import { describe, expect, it } from "vitest";
import {
  collectDroppedEntries,
  planFolderUploads,
  relativePathOf,
  type UploadEntry,
} from "./upload-tree";

function fileOf(name: string, relativePath?: string): File {
  const file = new File(["x"], name, { type: "text/plain" });
  if (relativePath !== undefined) {
    Object.defineProperty(file, "webkitRelativePath", {
      value: relativePath,
      configurable: true,
    });
  }
  return file;
}

function entry(name: string, path: string[]): UploadEntry {
  return { file: fileOf(name), path };
}

describe("relativePathOf", () => {
  it("usa webkitRelativePath para descobrir as pastas acima do arquivo", () => {
    const file = fileOf("ata.pdf", "Contratos/2025/ata.pdf");
    expect(relativePathOf(file)).toEqual(["Contratos", "2025"]);
  });

  it("devolve caminho vazio para arquivo solto", () => {
    expect(relativePathOf(fileOf("ata.pdf"))).toEqual([]);
  });

  it("ignora segmentos vazios e referencias relativas", () => {
    const file = fileOf("ata.pdf", "Contratos//./2025/ata.pdf");
    expect(relativePathOf(file)).toEqual(["Contratos", "2025"]);
  });
});

describe("planFolderUploads", () => {
  it("lista as pastas da arvore da mais rasa para a mais profunda", () => {
    const plan = planFolderUploads([
      entry("ata.pdf", ["Contratos", "2025"]),
      entry("capa.png", ["Contratos"]),
    ]);

    expect(plan.directories).toEqual([
      { path: ["Contratos"], parentPath: [], name: "Contratos" },
      { path: ["Contratos", "2025"], parentPath: ["Contratos"], name: "2025" },
    ]);
  });

  it("cria uma unica entrada por pasta mesmo com varios arquivos dentro", () => {
    const plan = planFolderUploads([
      entry("a.pdf", ["Contratos"]),
      entry("b.pdf", ["Contratos"]),
    ]);

    expect(plan.directories).toHaveLength(1);
  });

  it("nao lista pastas quando sao apenas arquivos soltos", () => {
    const plan = planFolderUploads([entry("a.pdf", []), entry("b.pdf", [])]);

    expect(plan.directories).toEqual([]);
  });

  it("mantem a ordem original dos arquivos com o caminho de destino", () => {
    const plan = planFolderUploads([
      entry("b.pdf", ["Contratos", "2025"]),
      entry("a.pdf", []),
    ]);

    expect(plan.files.map((item) => item.file.name)).toEqual(["b.pdf", "a.pdf"]);
    expect(plan.files.map((item) => item.path)).toEqual([["Contratos", "2025"], []]);
  });
});

type FakeEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (file: File) => void) => void;
  createReader?: () => { readEntries: (cb: (entries: FakeEntry[]) => void) => void };
};

function fileEntry(name: string): FakeEntry {
  const file = fileOf(name);
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (cb) => cb(file),
  };
}

function dirEntry(name: string, children: FakeEntry[]): FakeEntry {
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => {
      let done = false;
      return {
        readEntries: (cb) => {
          if (done) {
            cb([]);
            return;
          }
          done = true;
          cb(children);
        },
      };
    },
  };
}

function dataTransferOf(entries: FakeEntry[]): DataTransfer {
  return {
    items: entries.map((item) => ({
      kind: "file",
      webkitGetAsEntry: () => item,
    })),
    files: [],
  } as unknown as DataTransfer;
}

describe("collectDroppedEntries", () => {
  it("percorre a pasta arrastada e devolve os arquivos com o caminho relativo", async () => {
    const transfer = dataTransferOf([
      dirEntry("Contratos", [
        fileEntry("capa.png"),
        dirEntry("2025", [fileEntry("ata.pdf")]),
      ]),
    ]);

    const entries = await collectDroppedEntries(transfer);

    expect(
      entries.map((item) => [...item.path, item.file.name].join("/")).sort(),
    ).toEqual(["Contratos/2025/ata.pdf", "Contratos/capa.png"]);
  });

  it("trata arquivo solto arrastado como caminho vazio", async () => {
    const transfer = dataTransferOf([fileEntry("ata.pdf")]);

    const entries = await collectDroppedEntries(transfer);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.path).toEqual([]);
    expect(entries[0]!.file.name).toBe("ata.pdf");
  });

  it("usa dataTransfer.files quando o navegador nao expoe entradas", async () => {
    const transfer = {
      items: [],
      files: [fileOf("ata.pdf")],
    } as unknown as DataTransfer;

    const entries = await collectDroppedEntries(transfer);

    expect(entries.map((item) => item.file.name)).toEqual(["ata.pdf"]);
  });
});
