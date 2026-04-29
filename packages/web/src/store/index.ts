import { create } from "zustand";
import { db } from "../db";
import { syncAll, addPendingChange } from "../sync";
import { api, setToken, clearToken, setStoredUser, getStoredUser } from "../api/client";
import { Note, Tag, User } from "../types";

interface AppState {
  user: User | null;
  notes: Note[];
  tags: Tag[];
  space: "mine" | "shared";
  filter: { type?: string };
  searchQuery: string;
  loading: boolean;
  syncing: boolean;

  login: (pin: string) => Promise<void>;
  setup: (name: string, pin: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => void;

  setSpace: (space: "mine" | "shared") => void;
  setFilter: (filter: { type?: string }) => void;
  setSearchQuery: (query: string) => void;

  loadNotes: () => Promise<void>;
  loadTags: () => Promise<void>;
  createNote: (input: { type: string; title: string; content?: string; shared?: boolean; due_at?: string; tag_ids?: string[] }) => Promise<void>;
  updateNote: (id: string, input: Record<string, unknown>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  toggleDone: (id: string, isDone: boolean) => Promise<void>;
  reorderNotes: (ids: string[]) => Promise<void>;

  createTag: (name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;

  sync: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  notes: [],
  tags: [],
  space: "mine",
  filter: {},
  searchQuery: "",
  loading: false,
  syncing: false,

  login: async (pin) => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/login", { pin });
    setToken(res.token);
    setStoredUser(res.user);
    set({ user: res.user });
    await get().sync();
    await get().loadNotes();
    await get().loadTags();
  },

  setup: async (name, pin) => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/setup", { name, pin });
    setToken(res.token);
    setStoredUser(res.user);
    set({ user: res.user });
  },

  logout: () => {
    clearToken();
    localStorage.removeItem("user");
    set({ user: null, notes: [], tags: [] });
  },

  restoreSession: () => {
    const user = getStoredUser();
    if (user) set({ user });
  },

  setSpace: (space) => {
    set({ space });
    get().loadNotes();
  },

  setFilter: (filter) => {
    set({ filter });
    get().loadNotes();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().loadNotes();
  },

  loadNotes: async () => {
    const { user, space, filter, searchQuery } = get();
    if (!user) return;
    set({ loading: true });

    let notes = await db.notes.toArray();

    if (space === "mine") {
      notes = notes.filter((n) => n.owner_id === user.id && !n.shared);
    } else {
      notes = notes.filter((n) => n.shared);
    }

    if (filter.type) {
      notes = notes.filter((n) => n.type === filter.type);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      notes = notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }

    notes.sort((a, b) => a.sort_order - b.sort_order);
    set({ notes, loading: false });
  },

  loadTags: async () => {
    const tags = await db.tags.toArray();
    set({ tags });
  },

  createNote: async (input) => {
    const user = get().user;
    if (!user) return;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const notes = await db.notes.toArray();
    const maxOrder = notes.reduce((max, n) => Math.max(max, n.sort_order), 0);

    const note: Note = {
      id,
      owner_id: user.id,
      shared: input.shared || false,
      type: input.type,
      title: input.title,
      content: input.content || "",
      is_done: false,
      due_at: input.due_at || null,
      sort_order: maxOrder + 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      tag_ids: input.tag_ids || [],
    };

    await db.notes.put(note);
    await addPendingChange("create", "note", id, { ...input, id });
    await get().loadNotes();
    get().sync();
  },

  updateNote: async (id, input) => {
    const now = new Date().toISOString();
    const existing = await db.notes.get(id);
    if (!existing) return;

    const updated = { ...existing, ...input, updated_at: now };
    await db.notes.put(updated as Note);
    await addPendingChange("update", "note", id, input);
    await get().loadNotes();
    get().sync();
  },

  deleteNote: async (id) => {
    await db.notes.delete(id);
    await addPendingChange("delete", "note", id, {});
    await get().loadNotes();
    get().sync();
  },

  toggleDone: async (id, isDone) => {
    await get().updateNote(id, { is_done: isDone });
  },

  reorderNotes: async (ids) => {
    for (let i = 0; i < ids.length; i++) {
      await db.notes.update(ids[i], { sort_order: i });
    }
    await addPendingChange("update", "note", "batch-reorder", { ids });
    await get().loadNotes();
    get().sync();
  },

  createTag: async (name, color) => {
    const id = crypto.randomUUID();
    await db.tags.put({ id, name, color });
    await addPendingChange("create", "tag", id, { id, name, color });
    await get().loadTags();
    get().sync();
  },

  deleteTag: async (id) => {
    await db.tags.delete(id);
    await addPendingChange("delete", "tag", id, {});
    await get().loadTags();
    get().sync();
  },

  sync: async () => {
    if (get().syncing) return;
    set({ syncing: true });
    await syncAll();
    set({ syncing: false });
  },
}));
