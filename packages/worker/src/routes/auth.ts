import { Hono } from "hono";
import { createToken } from "../middleware/auth";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

auth.post("/setup", async (c) => {
  const { name, pin } = await c.req.json<{ name: string; pin: string }>();
  if (!name || !pin || pin.length < 4) {
    return c.json({ error: "Name and PIN (4+ digits) required" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
  if (existing && existing.count >= 2) {
    return c.json({ error: "Maximum 2 users allowed" }, 400);
  }

  const id = crypto.randomUUID();
  const pin_hash = await hashPin(pin);
  await c.env.DB.prepare("INSERT INTO users (id, name, pin_hash) VALUES (?, ?, ?)")
    .bind(id, name, pin_hash)
    .run();

  const token = await createToken({ user_id: id, name }, c.env.JWT_SECRET);
  return c.json({ token, user: { id, name } });
});

auth.post("/login", async (c) => {
  const { pin } = await c.req.json<{ pin: string }>();
  if (!pin) {
    return c.json({ error: "PIN required" }, 400);
  }

  const pin_hash = await hashPin(pin);
  const user = await c.env.DB.prepare("SELECT id, name FROM users WHERE pin_hash = ?")
    .bind(pin_hash)
    .first<{ id: string; name: string }>();

  if (!user) {
    return c.json({ error: "Invalid PIN" }, 401);
  }

  const token = await createToken({ user_id: user.id, name: user.name }, c.env.JWT_SECRET);
  return c.json({ token, user });
});

auth.get("/status", async (c) => {
  const count = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
  return c.json({ user_count: count?.count || 0 });
});

export { auth };
