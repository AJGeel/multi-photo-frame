import { describe, expect, it } from "vitest";
import { dropIndex, initialPhotosState, photosReducer, type Photo, type PhotosAction, type PhotosState } from "./photos";

const photo = (id: string): Photo => ({ id, src: `blob:${id}`, name: `${id}.jpg` });
const run = (actions: PhotosAction[], from: PhotosState = initialPhotosState) =>
  actions.reduce(photosReducer, from);
const ids = (s: PhotosState) => s.photos.map((p) => p.id);

const abcd = () => run([{ type: "add", photos: ["a", "b", "c", "d"].map(photo) }]);

describe("add", () => {
  it("appends, or inserts at an index", () => {
    expect(ids(abcd())).toEqual(["a", "b", "c", "d"]);
    expect(ids(run([{ type: "add", photos: [photo("x")], index: 1 }], abcd()))).toEqual(["a", "x", "b", "c", "d"]);
  });

  it("ignores duplicate ids and records no history for a no-op", () => {
    const before = abcd();
    expect(photosReducer(before, { type: "add", photos: [photo("a")] })).toBe(before);
    expect(before.past).toHaveLength(1);
  });
});

describe("remove", () => {
  it("removes photos and drops them from the selection", () => {
    const state = run([
      { type: "selectAll" },
      { type: "remove", ids: ["b", "c"] },
    ], abcd());
    expect(ids(state)).toEqual(["a", "d"]);
    expect(state.selection).toEqual(["a", "d"]);
  });

  it("is a no-op for unknown ids", () => {
    const before = abcd();
    expect(photosReducer(before, { type: "remove", ids: ["zzz"] })).toBe(before);
  });
});

describe("move", () => {
  it("moves one photo", () => {
    expect(ids(run([{ type: "move", ids: ["a"], toIndex: 2 }], abcd()))).toEqual(["b", "c", "a", "d"]);
  });

  it("moves a multi-selection together, keeping relative order", () => {
    expect(ids(run([{ type: "move", ids: ["d", "b"], toIndex: 0 }], abcd()))).toEqual(["b", "d", "a", "c"]);
  });

  it("clamps the index and ignores moves that change nothing", () => {
    expect(ids(run([{ type: "move", ids: ["a"], toIndex: 99 }], abcd()))).toEqual(["b", "c", "d", "a"]);
    const before = abcd();
    expect(photosReducer(before, { type: "move", ids: ["a"], toIndex: 0 })).toBe(before);
  });
});

describe("select", () => {
  it("replaces, toggles in list order, and selects ranges from the anchor", () => {
    let s = run([{ type: "select", id: "b", mode: "replace" }], abcd());
    expect(s.selection).toEqual(["b"]);
    s = run([{ type: "select", id: "a", mode: "toggle" }], s);
    expect(s.selection).toEqual(["a", "b"]);
    s = run([{ type: "select", id: "a", mode: "toggle" }], s);
    expect(s.selection).toEqual(["b"]);
    s = run([{ type: "select", id: "b", mode: "replace" }], s);
    s = run([{ type: "select", id: "d", mode: "range" }], s);
    expect(s.selection).toEqual(["b", "c", "d"]);
    s = run([{ type: "select", id: "a", mode: "range" }], s);
    expect(s.selection).toEqual(["a", "b"]);
  });

  it("does not touch history", () => {
    const s = run([{ type: "select", id: "a", mode: "replace" }, { type: "clearSelection" }], abcd());
    expect(s.past).toHaveLength(1);
    expect(s.selection).toEqual([]);
  });
});

describe("undo and redo", () => {
  it("undoes and redoes remove and move", () => {
    const edited = run([
      { type: "remove", ids: ["a"] },
      { type: "move", ids: ["d"], toIndex: 0 },
    ], abcd());
    expect(ids(edited)).toEqual(["d", "b", "c"]);
    const undone = run([{ type: "undo" }], edited);
    expect(ids(undone)).toEqual(["b", "c", "d"]);
    expect(ids(run([{ type: "undo" }], undone))).toEqual(["a", "b", "c", "d"]);
    expect(ids(run([{ type: "redo" }], undone))).toEqual(["d", "b", "c"]);
  });

  it("clears redo after a new edit", () => {
    const s = run([{ type: "remove", ids: ["a"] }, { type: "undo" }, { type: "remove", ids: ["b"] }], abcd());
    expect(s.future).toEqual([]);
    expect(ids(run([{ type: "redo" }], s))).toEqual(["a", "c", "d"]);
  });

  it("is a no-op with empty history", () => {
    expect(photosReducer(initialPhotosState, { type: "undo" })).toBe(initialPhotosState);
    expect(photosReducer(initialPhotosState, { type: "redo" })).toBe(initialPhotosState);
  });

  it("drops selection of photos that undo removes", () => {
    const s = run([{ type: "add", photos: [photo("x")] }, { type: "select", id: "x", mode: "replace" }, { type: "undo" }], abcd());
    expect(s.selection).toEqual([]);
  });
});

describe("dropIndex", () => {
  const photos = ["a", "b", "c", "d"].map(photo);

  it("matches the cell when moving a later photo earlier", () => {
    expect(dropIndex(photos, ["d"], 1)).toBe(1);
  });

  it("accounts for moved photos that sit before the cell", () => {
    expect(dropIndex(photos, ["a"], 2)).toBe(1);
    expect(ids(run([{ type: "move", ids: ["a"], toIndex: dropIndex(photos, ["a"], 2) }], abcd()))).toEqual(["b", "a", "c", "d"]);
    expect(dropIndex(photos, ["a", "b"], 3)).toBe(1);
  });

  it("clamps drops on empty cells past the end", () => {
    expect(dropIndex(photos, ["a"], 20)).toBe(3);
  });
});
