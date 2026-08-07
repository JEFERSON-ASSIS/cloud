import { describe, expect, it } from "vitest";
import { selectRunsToDelete } from "./retention";

function run(id: string, createdAt: string) {
  return { id, createdAt: new Date(createdAt), files: [] };
}

describe("selectRunsToDelete", () => {
  it("preserva âncoras diárias, semanais e mensais", () => {
    const runs = [
      run("d1", "2026-08-07T10:00:00Z"),
      run("d2", "2026-08-06T10:00:00Z"),
      run("d3", "2026-08-05T10:00:00Z"),
      run("w-old", "2026-07-20T10:00:00Z"),
      run("m-old", "2026-06-01T10:00:00Z"),
      run("drop", "2026-05-01T10:00:00Z"),
    ];

    const toDelete = selectRunsToDelete(runs, 2, 2, 3).map((item) => item.id);
    expect(toDelete).toEqual(["d3", "drop"]);
  });

  it("não apaga nada quando a retenção cobre todos os runs", () => {
    const runs = [run("a", "2026-08-07T10:00:00Z"), run("b", "2026-08-06T10:00:00Z")];
    expect(selectRunsToDelete(runs, 7, 4, 6)).toEqual([]);
  });
});
