import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";

type Bindings = { DB: D1Database; JWT_SECRET: string };
type Variables = { user: { user_id: string; name: string } };

const notes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
notes.use("/*", authMiddleware);

notes.get("/", async (c) => {
  const user = c.get("user");
  const since = c.req.query("since");

  let sql = `SELECT n.*, GROUP_CONCAT(nt.tag_id) as tag_ids
    FROM notes n LEFT JOIN note_tags nt ON nt.note_id = n.id
    WHERE (n.owner_id = ? OR n.shared = 1) AND n.deleted_at IS NULL`;
  const params: string[] = [user.user_id];

  if (since) {
    sql += " AND n.updated_at > ?";
    params.push(since);
  }

  sql += " GROUP BY n.id ORDER BY n.sort_order ASC";

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  const notesResult = (results || []).map((row: Record<string, unknown>) => ({
    ...row,
    tag_ids: row.tag_ids ? (row.tag_ids as string).split(",") : [],
  }));
  return c.json(notesResult);
});

notes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    id?: string;
    type: string;
    title: string;
    content?: string;
    shared?: boolean;
    due_at?: string;
    tag_ids?: string[];
  }>();

  const id = body.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const maxOrder = await c.env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) as max_order FROM notes")
    .first<{ max_order: number }>();

  await c.env.DB.prepare(
    `INSERT INTO notes (id, owner_id, shared, type, title, content, due_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, user.user_id, body.shared ? 1 : 0, body.type, body.title,
    body.content || "", body.due_at || null, (maxOrder?.max_order || 0) + 1, now, now
  ).run();

  if (body.tag_ids?.length) {
    const batch = body.tag_ids.map((tagId) =>
      c.env.DB.prepare("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)").bind(id, tagId)
    );
    await c.env.DB.batch(batch);
  }

  return c.json({ id, created_at: now, updated_at: now }, 201);
});

notes.put("/reorder", async (c) => {
  const { ids } = await c.req.json<{ ids: string[] }>();
  const batch = ids.map((id, index) =>
    c.env.DB.prepare("UPDATE notes SET sort_order = ?, updated_at = datetime('now') WHERE id = ?").bind(index, id)
  );
  await c.env.DB.batch(batch);
  return c.json({ success: true });
});

notes.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    content?: string;
    type?: string;
    shared?: boolean;
    is_done?: boolean;
    due_at?: string | null;
    tag_ids?: string[];
  }>();

  const note = await c.env.DB.prepare("SELECT owner_id, shared FROM notes WHERE id = ? AND deleted_at IS NULL")
    .bind(id).first<{ owner_id: string; shared: number }>();

  if (!note) return c.json({ error: "Not found" }, 404);
  if (note.owner_id !== user.user_id && !note.shared) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.title !== undefined) { sets.push("title = ?"); params.push(body.title); }
  if (body.content !== undefined) { sets.push("content = ?"); params.push(body.content); }
  if (body.type !== undefined) { sets.push("type = ?"); params.push(body.type); }
  if (body.shared !== undefined) { sets.push("shared = ?"); params.push(body.shared ? 1 : 0); }
  if (body.is_done !== undefined) { sets.push("is_done = ?"); params.push(body.is_done ? 1 : 0); }
  if (body.due_at !== undefined) { sets.push("due_at = ?"); params.push(body.due_at); }

  if (sets.length > 0) {
    const now = new Date().toISOString();
    sets.push("updated_at = ?");
    params.push(now);
    params.push(id);
    await c.env.DB.prepare(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  }

  if (body.tag_ids !== undefined) {
    await c.env.DB.prepare("DELETE FROM note_tags WHERE note_id = ?").bind(id).run();
    if (body.tag_ids.length) {
      const batch = body.tag_ids.map((tagId) =>
        c.env.DB.prepare("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)").bind(id, tagId)
      );
      await c.env.DB.batch(batch);
    }
  }

  return c.json({ success: true });
});

notes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const note = await c.env.DB.prepare("SELECT owner_id, shared FROM notes WHERE id = ? AND deleted_at IS NULL")
    .bind(id).first<{ owner_id: string; shared: number }>();

  if (!note) return c.json({ error: "Not found" }, 404);
  if (note.owner_id !== user.user_id && !note.shared) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare("UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, id).run();

  return c.json({ success: true });
});

export { notes };
