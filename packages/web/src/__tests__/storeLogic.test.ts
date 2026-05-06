import { describe, it, expect } from "vitest";
import { matchNote } from "../utils/fuzzySearch";

// Test the sorting and filtering logic extracted from store/index.ts
// These are pure functions that we can test without Zustand/Dexie

interface MockNote {
  id: string;
  owner_id: string;
  shared: boolean;
  type: string;
  title: string;
  content: string;
  updated_at: string;
  sort_order: number;
}

function createMockNote(overrides: Partial<MockNote> = {}): MockNote {
  return {
    id: "note-" + Math.random().toString(36).slice(2),
    owner_id: "user-1",
    shared: false,
    type: "memo",
    title: "Test Note",
    content: "Content",
    updated_at: "2026-01-01T00:00:00Z",
    sort_order: 0,
    ...overrides,
  };
}

describe("Note sorting (updated_at descending)", () => {
  it("sorts newest first", () => {
    const notes = [
      createMockNote({ id: "old", updated_at: "2026-01-01T00:00:00Z" }),
      createMockNote({ id: "new", updated_at: "2026-01-03T00:00:00Z" }),
      createMockNote({ id: "mid", updated_at: "2026-01-02T00:00:00Z" }),
    ];

    notes.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    expect(notes[0].id).toBe("new");
    expect(notes[1].id).toBe("mid");
    expect(notes[2].id).toBe("old");
  });

  it("handles same timestamp", () => {
    const notes = [
      createMockNote({ id: "a", updated_at: "2026-01-01T00:00:00Z" }),
      createMockNote({ id: "b", updated_at: "2026-01-01T00:00:00Z" }),
    ];
    notes.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    expect(notes.length).toBe(2);
  });
});

describe("Note filtering", () => {
  const notes = [
    createMockNote({ type: "memo", owner_id: "user-1", shared: false }),
    createMockNote({ type: "todo", owner_id: "user-1", shared: false }),
    createMockNote({ type: "memo", owner_id: "user-1", shared: true }),
    createMockNote({ type: "todo", owner_id: "user-2", shared: true }),
  ];

  it("filters by space=mine (own non-shared notes)", () => {
    const userId = "user-1";
    const mine = notes.filter((n) => n.owner_id === userId && !n.shared);
    expect(mine.length).toBe(2);
    expect(mine.every((n) => !n.shared)).toBe(true);
  });

  it("filters by space=shared", () => {
    const shared = notes.filter((n) => n.shared);
    expect(shared.length).toBe(2);
  });

  it("filters by type", () => {
    const memos = notes.filter((n) => n.type === "memo");
    expect(memos.length).toBe(2);
  });

  it("combines space and type filter", () => {
    const userId = "user-1";
    const myTodos = notes
      .filter((n) => n.owner_id === userId && !n.shared)
      .filter((n) => n.type === "todo");
    expect(myTodos.length).toBe(1);
  });
});

describe("Search filtering integration", () => {
  it("filters notes using matchNote", () => {
    const notes = [
      createMockNote({ title: "工作规划", content: "详细内容" }),
      createMockNote({ title: "旅游计划", content: "去日本" }),
      createMockNote({ title: "Shopping List", content: "buy milk" }),
    ];

    const query = "规划";
    const results = notes.filter((n) => matchNote(n.title, n.content, query));
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("工作规划");
  });

  it("multi-token search narrows results", () => {
    const notes = [
      createMockNote({ title: "工作规划", content: "详细内容" }),
      createMockNote({ title: "学习规划", content: "英语学习" }),
    ];

    const results = notes.filter((n) => matchNote(n.title, n.content, "规划 工作"));
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("工作规划");
  });

  it("pinyin search works on titles", () => {
    const notes = [
      createMockNote({ title: "工作规划", content: "" }),
      createMockNote({ title: "旅游计划", content: "" }),
    ];

    const results = notes.filter((n) => matchNote(n.title, n.content, "gzgh"));
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("工作规划");
  });
});
