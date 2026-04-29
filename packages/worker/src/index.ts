import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./routes/auth";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.route("/api/auth", auth);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.resolve());
  },
};
