import { db, getLastSync, setLastSync } from "../db";
import { api } from "../api/client";
import { Note, PendingChange } from "../types";

export async function pushPendingChanges(): Promise<void> {
  const changes = await db.pendingChanges.orderBy("created_at").toArray();

  for (const change of changes) {
    try {
      if (change.entity === "note") {
        switch (change.action) {
          case "create":
            await api.post("/api/notes", change.payload);
            break;
          case "update":
            await api.put(`/api/notes/${change.entity_id}`, change.payload);
            break;
          case "delete":
            await api.delete(`/api/notes/${change.entity_id}`);
            break;
        }
      } else if (change.entity === "tag") {
        switch (change.action) {
          case "create":
            await api.post("/api/tags", change.payload);
            break;
          case "delete":
            await api.delete(`/api/tags/${change.entity_id}`);
            break;
        }
      }
      await db.pendingChanges.delete(change.id);
    } catch (err) {
      console.error("Sync push failed for", change.id, err);
      break;
    }
  }
}

export async function pullChanges(): Promise<void> {
  const since = getLastSync();
  const params = since ? `?since=${encodeURIComponent(since)}` : "";

  const notes = await api.get<Note[]>(`/api/notes${params}`);
  const now = new Date().toISOString();

  await db.transaction("rw", db.notes, async () => {
    for (const note of notes) {
      if (note.deleted_at) {
        await db.notes.delete(note.id);
      } else {
        const local = await db.notes.get(note.id);
        if (!local || local.updated_at <= note.updated_at) {
          await db.notes.put(note);
        }
      }
    }
  });

  setLastSync(now);
}

export async function syncAll(): Promise<void> {
  try {
    await pushPendingChanges();
    await pullChanges();
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

export async function addPendingChange(
  action: PendingChange["action"],
  entity: PendingChange["entity"],
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.pendingChanges.add({
    id: crypto.randomUUID(),
    action,
    entity,
    entity_id: entityId,
    payload,
    created_at: new Date().toISOString(),
  });
}
