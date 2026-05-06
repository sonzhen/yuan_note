import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => {
  const mockNotes = {
    get: vi.fn(),
    put: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toArray: vi.fn().mockResolvedValue([]),
  };
  const mockPendingChanges = {
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    orderBy: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        and: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
        first: vi.fn().mockResolvedValue(null),
        sortBy: vi.fn().mockResolvedValue([]),
      }),
    }),
    toArray: vi.fn().mockResolvedValue([]),
  };
  const mockNoteBackups = {
    add: vi.fn(),
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        sortBy: vi.fn().mockResolvedValue([]),
      }),
    }),
    bulkDelete: vi.fn(),
  };
  return {
    db: {
      notes: mockNotes,
      pendingChanges: mockPendingChanges,
      noteBackups: mockNoteBackups,
      transaction: vi.fn(async (_mode: string, _table: unknown, fn: () => Promise<void>) => fn()),
    },
    getLastSync: vi.fn().mockReturnValue(null),
    setLastSync: vi.fn(),
  };
});

vi.mock("../api/client", () => {
  class ConflictError extends Error {
    note: Record<string, unknown>;
    constructor(note: Record<string, unknown>) {
      super("Conflict");
      this.note = note;
    }
  }
  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    ConflictError,
  };
});

import { db } from "../db";
import { api, ConflictError } from "../api/client";
import { addPendingChange, pushPendingChanges, pullChanges, setConflictHandler } from "../sync";

const mockNotes = db.notes as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockPendingChanges = db.pendingChanges as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockNoteBackups = db.noteBackups as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  setConflictHandler(null);

  // Reset default mocks
  mockPendingChanges.orderBy.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
  mockPendingChanges.where.mockReturnValue({
    equals: vi.fn().mockReturnValue({
      and: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
      first: vi.fn().mockResolvedValue(null),
      sortBy: vi.fn().mockResolvedValue([]),
    }),
  });
  mockPendingChanges.toArray.mockResolvedValue([]);
  mockNotes.toArray.mockResolvedValue([]);
  mockNoteBackups.where.mockReturnValue({
    equals: vi.fn().mockReturnValue({
      sortBy: vi.fn().mockResolvedValue([]),
    }),
  });
});

describe("addPendingChange", () => {
  it("adds a new pending change", async () => {
    await addPendingChange("create", "note", "note-1", { title: "test" });
    expect(mockPendingChanges.add).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entity: "note",
        entity_id: "note-1",
        payload: { title: "test" },
      })
    );
  });

  it("coalesces consecutive updates to same note", async () => {
    const existingChange = {
      id: "change-1",
      action: "update",
      entity: "note",
      entity_id: "note-1",
      payload: { title: "old" },
      created_at: "2026-01-01T00:00:00Z",
    };

    mockPendingChanges.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        and: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(existingChange) }),
        first: vi.fn().mockResolvedValue(existingChange),
      }),
    });

    await addPendingChange("update", "note", "note-1", { content: "new content" });

    expect((db.pendingChanges as any).update).toHaveBeenCalledWith("change-1", {
      payload: { title: "old", content: "new content" },
      created_at: expect.any(String),
    });
    expect(mockPendingChanges.add).not.toHaveBeenCalled();
  });

  it("does not coalesce batch-reorder updates", async () => {
    await addPendingChange("update", "note", "batch-reorder", { ids: ["a", "b"] });
    expect(mockPendingChanges.add).toHaveBeenCalled();
  });
});

describe("pushPendingChanges", () => {
  it("pushes create note and deletes pending change", async () => {
    const change = {
      id: "c-1",
      action: "create",
      entity: "note",
      entity_id: "note-1",
      payload: { id: "note-1", title: "test" },
      created_at: "2026-01-01T00:00:00Z",
    };
    mockPendingChanges.orderBy.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([change]),
    });
    mockApi.post.mockResolvedValue({ success: true });

    await pushPendingChanges();

    expect(mockApi.post).toHaveBeenCalledWith("/api/notes", change.payload);
    expect(mockPendingChanges.delete).toHaveBeenCalledWith("c-1");
  });

  it("pushes update note with base_version from local note", async () => {
    const change = {
      id: "c-2",
      action: "update",
      entity: "note",
      entity_id: "note-2",
      payload: { content: "updated" },
      created_at: "2026-01-01T00:00:00Z",
    };
    mockPendingChanges.orderBy.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([change]),
    });
    mockNotes.get.mockResolvedValue({ id: "note-2", version: 3, content: "updated" });
    mockApi.put.mockResolvedValue({ success: true, version: 4, updated_at: "2026-01-01T01:00:00Z" });

    await pushPendingChanges();

    expect(mockApi.put).toHaveBeenCalledWith("/api/notes/note-2", {
      content: "updated",
      base_version: 3,
    });
    expect(mockNotes.update).toHaveBeenCalledWith("note-2", {
      version: 4,
      base_content: "updated",
      updated_at: "2026-01-01T01:00:00Z",
    });
  });

  it("pushes delete note", async () => {
    const change = {
      id: "c-3",
      action: "delete",
      entity: "note",
      entity_id: "note-3",
      payload: {},
      created_at: "2026-01-01T00:00:00Z",
    };
    mockPendingChanges.orderBy.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([change]),
    });
    mockApi.delete.mockResolvedValue({ success: true });

    await pushPendingChanges();

    expect(mockApi.delete).toHaveBeenCalledWith("/api/notes/note-3");
    expect(mockPendingChanges.delete).toHaveBeenCalledWith("c-3");
  });

  it("handles 409 conflict - auto-merges when no conflicts", async () => {
    const change = {
      id: "c-4",
      action: "update",
      entity: "note",
      entity_id: "note-4",
      payload: { content: "<p>local edit</p>" },
      created_at: "2026-01-01T00:00:00Z",
    };
    mockPendingChanges.orderBy.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([change]),
    });
    // base_content === remote means only local changed → auto-merge uses local
    mockNotes.get.mockResolvedValue({
      id: "note-4",
      version: 1,
      content: "<p>local edit</p>",
      base_content: "<p>original</p>",
    });

    const remoteNote = {
      id: "note-4",
      version: 2,
      content: "<p>original</p>", // remote unchanged from base
      updated_at: "2026-01-01T01:00:00Z",
    };
    mockApi.put.mockRejectedValue(new ConflictError(remoteNote as unknown as Record<string, unknown>));

    await pushPendingChanges();

    expect(mockPendingChanges.delete).toHaveBeenCalledWith("c-4");
    expect(mockNoteBackups.add).toHaveBeenCalled();
    // Should auto-merge since base === remote → use local
    expect(mockNotes.update).toHaveBeenCalledWith("note-4", expect.objectContaining({
      content: "<p>local edit</p>",
      version: 2,
    }));
  });

  it("drops 404 errors and continues", async () => {
    const change = {
      id: "c-5",
      action: "update",
      entity: "note",
      entity_id: "note-5",
      payload: { content: "x" },
      created_at: "2026-01-01T00:00:00Z",
    };
    mockPendingChanges.orderBy.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([change]),
    });
    mockNotes.get.mockResolvedValue({ id: "note-5", version: 1, content: "x" });
    mockApi.put.mockRejectedValue(new Error("HTTP 404"));

    await pushPendingChanges();

    expect(mockPendingChanges.delete).toHaveBeenCalledWith("c-5");
  });

  it("pushes tag create and delete", async () => {
    const changes = [
      {
        id: "c-6",
        action: "create",
        entity: "tag",
        entity_id: "tag-1",
        payload: { id: "tag-1", name: "Work", color: "#ff0000" },
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "c-7",
        action: "delete",
        entity: "tag",
        entity_id: "tag-2",
        payload: {},
        created_at: "2026-01-01T00:01:00Z",
      },
    ];
    mockPendingChanges.orderBy.mockReturnValue({
      toArray: vi.fn().mockResolvedValue(changes),
    });
    mockApi.post.mockResolvedValue({ success: true });
    mockApi.delete.mockResolvedValue({ success: true });

    await pushPendingChanges();

    expect(mockApi.post).toHaveBeenCalledWith("/api/tags", changes[0].payload);
    expect(mockApi.delete).toHaveBeenCalledWith("/api/tags/tag-2");
    expect(mockPendingChanges.delete).toHaveBeenCalledWith("c-6");
    expect(mockPendingChanges.delete).toHaveBeenCalledWith("c-7");
  });
});

describe("pullChanges", () => {
  it("puts remote notes into local db", async () => {
    const remoteNotes = [
      { id: "n-1", title: "remote note", content: "content", version: 2, deleted_at: null },
    ];
    mockApi.get.mockResolvedValue(remoteNotes);

    await pullChanges();

    expect(mockNotes.put).toHaveBeenCalledWith({
      ...remoteNotes[0],
      version: 2,
      base_content: "content",
    });
  });

  it("deletes notes that have deleted_at set", async () => {
    const remoteNotes = [
      { id: "n-2", title: "deleted", content: "", version: 1, deleted_at: "2026-01-01T00:00:00Z" },
    ];
    mockApi.get.mockResolvedValue(remoteNotes);

    await pullChanges();

    expect(mockNotes.delete).toHaveBeenCalledWith("n-2");
  });

  it("skips notes with pending local changes", async () => {
    const remoteNotes = [
      { id: "n-3", title: "remote", content: "remote content", version: 3, deleted_at: null },
    ];
    mockApi.get.mockResolvedValue(remoteNotes);
    mockPendingChanges.toArray.mockResolvedValue([
      { id: "c-1", entity_id: "n-3", action: "update", entity: "note", payload: {}, created_at: "" },
    ]);

    await pullChanges();

    expect(mockNotes.put).not.toHaveBeenCalled();
  });
});

describe("conflict handling with UI callback", () => {
  it("calls conflict handler when three-way merge has unresolvable conflicts", async () => {
    const change = {
      id: "c-10",
      action: "update",
      entity: "note",
      entity_id: "note-10",
      payload: { content: "<p>local change</p>" },
      created_at: "2026-01-01T00:00:00Z",
    };
    mockPendingChanges.orderBy.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([change]),
    });
    // Both local and remote changed from base → conflict
    mockNotes.get.mockResolvedValue({
      id: "note-10",
      version: 1,
      content: "<p>local change</p>",
      base_content: "<p>original</p>",
    });

    const remoteNote = {
      id: "note-10",
      version: 2,
      content: "<p>remote change</p>",
      updated_at: "2026-01-01T01:00:00Z",
    };
    mockApi.put.mockRejectedValue(new ConflictError(remoteNote as unknown as Record<string, unknown>));

    let capturedConflicts: unknown[] = [];
    let capturedResolve: ((choices: ("local" | "remote")[]) => void) | null = null;

    setConflictHandler((_noteId, _merged, conflicts, resolve, _dismiss) => {
      capturedConflicts = conflicts;
      capturedResolve = resolve;
    });

    const pushPromise = pushPendingChanges();

    // Wait for the conflict handler to be called
    await new Promise((r) => setTimeout(r, 50));

    expect(capturedConflicts.length).toBe(1);
    expect(capturedResolve).not.toBeNull();

    // Resolve with local choice
    capturedResolve!(["local"]);
    await pushPromise;

    expect(mockNotes.update).toHaveBeenCalledWith("note-10", expect.objectContaining({
      content: "<p>local change</p>",
      version: 2,
    }));
  });
});
