import Dexie, { type Table } from "dexie";
import { Note, Tag, PendingChange } from "../types";

class MemoDatabase extends Dexie {
  notes!: Table<Note, string>;
  tags!: Table<Tag, string>;
  pendingChanges!: Table<PendingChange, string>;

  constructor() {
    super("memo-widget");
    this.version(1).stores({
      notes: "id, owner_id, shared, type, updated_at, sort_order",
      tags: "id, name",
      pendingChanges: "id, entity, entity_id, created_at",
    });
  }
}

export const db = new MemoDatabase();

export function getLastSync(): string | null {
  return localStorage.getItem("last_sync");
}

export function setLastSync(time: string) {
  localStorage.setItem("last_sync", time);
}
