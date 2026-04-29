import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";

type Bindings = { DB: D1Database; JWT_SECRET: string };
type Variables = { user: { user_id: string; name: string } };

const push = new Hono<{ Bindings: Bindings; Variables: Variables }>();
push.use("/*", authMiddleware);

push.post("/subscribe", async (c) => {
  const user = c.get("user");
  const { subscription } = await c.req.json<{ subscription: string }>();
  if (!subscription) return c.json({ error: "subscription required" }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO push_subscriptions (id, user_id, subscription) VALUES (?, ?, ?)"
  ).bind(id, user.user_id, subscription).run();

  return c.json({ success: true }, 201);
});

push.delete("/subscribe", async (c) => {
  const user = c.get("user");
  await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ?")
    .bind(user.user_id).run();
  return c.json({ success: true });
});

export { push };
