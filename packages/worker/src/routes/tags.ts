import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";

type Bindings = { DB: D1Database; JWT_SECRET: string };

const tags = new Hono<{ Bindings: Bindings }>();
tags.use("/*", authMiddleware);

tags.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name, color FROM tags ORDER BY name ASC").all();
  return c.json(results || []);
});

tags.post("/", async (c) => {
  const { name, color } = await c.req.json<{ name: string; color: string }>();
  if (!name || !color) return c.json({ error: "name and color required" }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)").bind(id, name, color).run();
  return c.json({ id, name, color }, 201);
});

tags.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM note_tags WHERE tag_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

export { tags };
