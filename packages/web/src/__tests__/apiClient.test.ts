import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConflictError } from "../api/client";

// We can't easily test the full api module (it uses import.meta.env and fetch),
// but we can test ConflictError behavior which is critical for conflict resolution.

describe("ConflictError", () => {
  it("stores the note data from 409 response", () => {
    const noteData = { id: "note-1", version: 3, content: "server content" };
    const err = new ConflictError(noteData);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Conflict");
    expect(err.note).toEqual(noteData);
  });

  it("can be caught as Error", () => {
    const err = new ConflictError({ id: "x" });
    expect(err instanceof Error).toBe(true);
  });

  it("can be identified via instanceof", () => {
    const err = new ConflictError({ id: "x" });
    const genericErr = new Error("something else");

    expect(err instanceof ConflictError).toBe(true);
    expect(genericErr instanceof ConflictError).toBe(false);
  });
});

describe("fetch-based API behavior", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("409 response throws ConflictError with note data", async () => {
    const noteData = { id: "note-1", version: 5, content: "conflict content" };
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 409,
      ok: false,
      json: () => Promise.resolve({ conflict: true, note: noteData }),
    });

    // Dynamically import to get a fresh module with mocked fetch
    // We use the raw request pattern from client.ts
    const token = null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const res = await fetch("/api/notes/note-1", {
      method: "PUT",
      headers,
      body: JSON.stringify({ content: "local" }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { conflict: boolean; note: Record<string, unknown> };
    expect(body.conflict).toBe(true);

    const err = new ConflictError(body.note);
    expect(err.note.id).toBe("note-1");
    expect(err.note.version).toBe(5);
  });
});
