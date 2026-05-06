import { describe, it, expect, vi } from "vitest";
import { parseFiles } from "../utils/fileParser";

function createMockFile(name: string, content: string, type = "text/plain"): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

describe("parseFiles", () => {
  it("parses .md files to HTML", async () => {
    const file = createMockFile("test.md", "# Hello\n\nWorld");
    const result = await parseFiles([file]);
    expect(result.success).toHaveLength(1);
    expect(result.success[0].title).toBe("test");
    expect(result.success[0].html).toContain("<h1>");
    expect(result.success[0].html).toContain("Hello");
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("extracts title from filename without extension", async () => {
    const file = createMockFile("工作规划.md", "content");
    const result = await parseFiles([file]);
    expect(result.success[0].title).toBe("工作规划");
  });

  it("skips unsupported file types", async () => {
    const file = createMockFile("photo.png", "binary data");
    const result = await parseFiles([file]);
    expect(result.success).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toBe("photo.png");
  });

  it("handles multiple files with mixed types", async () => {
    const md = createMockFile("notes.md", "# Notes");
    const txt = createMockFile("readme.txt", "text");
    const result = await parseFiles([md, txt]);
    expect(result.success).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it("reports failed files without stopping others", async () => {
    const good = createMockFile("good.md", "# Works");
    const bad = createMockFile("bad.docx", "not a real docx");
    const result = await parseFiles([good, bad]);
    expect(result.success).toHaveLength(1);
    expect(result.success[0].title).toBe("good");
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toBe("bad.docx");
  });
});
