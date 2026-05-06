import { describe, it, expect } from "vitest";
import { splitIntoBlocks, threeWayMerge, applyResolutions } from "../sync/merge";

describe("splitIntoBlocks", () => {
  it("splits by closing p tags", () => {
    const html = "<p>first</p><p>second</p>";
    expect(splitIntoBlocks(html)).toEqual(["<p>first</p>", "<p>second</p>"]);
  });

  it("handles headings", () => {
    const html = "<h1>title</h1><p>body</p>";
    expect(splitIntoBlocks(html)).toEqual(["<h1>title</h1>", "<p>body</p>"]);
  });

  it("handles hr as block boundary", () => {
    const html = "<p>before</p><hr><p>after</p>";
    expect(splitIntoBlocks(html)).toEqual(["<p>before</p>", "<hr>", "<p>after</p>"]);
  });

  it("returns empty array for empty/whitespace input", () => {
    expect(splitIntoBlocks("")).toEqual([]);
    expect(splitIntoBlocks("   ")).toEqual([]);
  });

  it("captures trailing content without block tag", () => {
    const html = "<p>first</p>trailing text";
    expect(splitIntoBlocks(html)).toEqual(["<p>first</p>", "trailing text"]);
  });

  it("handles nested lists as single block", () => {
    const html = "<ul><li>item1</li><li>item2</li></ul><p>after</p>";
    const blocks = splitIntoBlocks(html);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[blocks.length - 1]).toBe("<p>after</p>");
  });
});

describe("threeWayMerge", () => {
  it("returns remote when local unchanged", () => {
    const base = "<p>hello</p>";
    const local = "<p>hello</p>";
    const remote = "<p>hello world</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.join("")).toBe("<p>hello world</p>");
  });

  it("returns local when remote unchanged", () => {
    const base = "<p>hello</p>";
    const local = "<p>hello world</p>";
    const remote = "<p>hello</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.join("")).toBe("<p>hello world</p>");
  });

  it("no conflict when both make same change", () => {
    const base = "<p>hello</p>";
    const local = "<p>hi</p>";
    const remote = "<p>hi</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.join("")).toBe("<p>hi</p>");
  });

  it("detects conflict when both change same block differently", () => {
    const base = "<p>original</p>";
    const local = "<p>local edit</p>";
    const remote = "<p>remote edit</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].local).toBe("<p>local edit</p>");
    expect(result.conflicts[0].remote).toBe("<p>remote edit</p>");
  });

  it("merges non-conflicting changes to different blocks", () => {
    const base = "<p>first</p><p>second</p>";
    const local = "<p>first modified</p><p>second</p>";
    const remote = "<p>first</p><p>second modified</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.join("")).toBe("<p>first modified</p><p>second modified</p>");
  });

  it("handles local deletion + remote edit as conflict", () => {
    const base = "<p>keep</p><p>changeme</p>";
    const local = "<p>keep</p>";
    const remote = "<p>keep</p><p>changed</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].local).toBe("");
    expect(result.conflicts[0].remote).toBe("<p>changed</p>");
  });

  it("handles local edit + remote deletion as conflict", () => {
    const base = "<p>keep</p><p>changeme</p>";
    const local = "<p>keep</p><p>changed</p>";
    const remote = "<p>keep</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].local).toBe("<p>changed</p>");
    expect(result.conflicts[0].remote).toBe("");
  });

  it("both delete same block — no conflict", () => {
    const base = "<p>first</p><p>delete me</p><p>third</p>";
    const local = "<p>first</p><p>third</p>";
    const remote = "<p>first</p><p>third</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.join("")).toBe("<p>first</p><p>third</p>");
  });

  it("handles insertions from one side", () => {
    const base = "<p>first</p><p>second</p>";
    const local = "<p>first</p><p>inserted</p><p>second</p>";
    const remote = "<p>first</p><p>second</p>";
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toContain("<p>inserted</p>");
  });
});

describe("applyResolutions", () => {
  it("replaces conflict placeholders with chosen side", () => {
    const merged = ["<p>first</p>", "", "<p>third</p>"];
    const conflicts = [{ index: 1, local: "<p>local</p>", remote: "<p>remote</p>" }];

    const resultLocal = applyResolutions(merged, conflicts, ["local"]);
    expect(resultLocal).toBe("<p>first</p><p>local</p><p>third</p>");

    const resultRemote = applyResolutions(merged, conflicts, ["remote"]);
    expect(resultRemote).toBe("<p>first</p><p>remote</p><p>third</p>");
  });

  it("handles deletion choice (empty string)", () => {
    const merged = ["<p>keep</p>", ""];
    const conflicts = [{ index: 1, local: "", remote: "<p>remote added</p>" }];

    const result = applyResolutions(merged, conflicts, ["local"]);
    expect(result).toBe("<p>keep</p>");
  });

  it("handles multiple conflicts", () => {
    const merged = ["", "<p>middle</p>", ""];
    const conflicts = [
      { index: 0, local: "<p>A</p>", remote: "<p>B</p>" },
      { index: 2, local: "<p>C</p>", remote: "<p>D</p>" },
    ];
    const result = applyResolutions(merged, conflicts, ["local", "remote"]);
    expect(result).toBe("<p>A</p><p>middle</p><p>D</p>");
  });
});
