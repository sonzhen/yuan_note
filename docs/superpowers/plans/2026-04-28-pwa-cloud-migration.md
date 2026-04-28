# MemoWidget PWA + Cloudflare 迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 MemoWidget 从 Tauri 桌面应用改造为 PWA + Cloudflare Workers/D1 云端架构，支持离线优先、双人 PIN 登录、个人/共享笔记空间。

**Architecture:** Monorepo 结构，`packages/web` 是 React PWA 前端，`packages/worker` 是 Cloudflare Workers API。前端离线优先（IndexedDB via Dexie.js），联网后增量同步到 D1。认证使用 PIN + JWT。

**Tech Stack:** React 19, TypeScript, Vite, Zustand, Dexie.js, Hono, Cloudflare Workers, Cloudflare D1, Web Push, vite-plugin-pwa

---

## 文件结构

```
memo-widget/
├── package.json                          # monorepo root (npm workspaces)
├── packages/
│   ├── web/                              # 前端 PWA
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── public/
│   │   │   ├── manifest.json
│   │   │   ├── icon-192.png
│   │   │   └── icon-512.png
│   │   └── src/
│   │       ├── main.tsx                  # React 入口
│   │       ├── App.tsx                   # 路由 + 布局
│   │       ├── App.css                   # 全局暗色样式
│   │       ├── types.ts                  # 类型定义
│   │       ├── db/
│   │       │   └── index.ts             # Dexie.js schema + 操作
│   │       ├── sync/
│   │       │   └── index.ts             # 同步引擎 (pull/push/conflict)
│   │       ├── api/
│   │       │   └── client.ts            # fetch 封装 (token 注入)
│   │       ├── store/
│   │       │   └── index.ts             # Zustand store
│   │       ├── components/
│   │       │   ├── PinScreen.tsx         # PIN 登录/设置页
│   │       │   ├── TitleBar.tsx          # 标题栏
│   │       │   ├── SpaceTabs.tsx         # 我的/共享 切换
│   │       │   ├── Toolbar.tsx           # 筛选 + 搜索 + 新建
│   │       │   ├── NoteList.tsx          # 笔记列表 (dnd-kit)
│   │       │   ├── NoteItem.tsx          # 单条笔记
│   │       │   ├── EditView.tsx          # 编辑页
│   │       │   ├── MilkdownEditor.tsx    # Markdown 编辑器
│   │       │   └── SettingsPanel.tsx     # 设置面板
│   │       └── sw.ts                     # Service Worker
│   └── worker/                           # Cloudflare Workers API
│       ├── package.json
│       ├── tsconfig.json
│       ├── wrangler.toml
│       ├── schema.sql                    # D1 建表语句
│       └── src/
│           ├── index.ts                  # Hono app 入口 + cron handler
│           ├── middleware/
│           │   └── auth.ts              # JWT 验证中间件
│           ├── routes/
│           │   ├── auth.ts              # /api/auth/setup, /api/auth/login
│           │   ├── notes.ts             # /api/notes CRUD
│           │   ├── tags.ts              # /api/tags CRUD
│           │   └── push.ts             # /api/push/subscribe
│           └── cron/
│               └── reminders.ts         # 定时提醒推送
└── docs/
```

---

## Task 1: Monorepo 脚手架搭建

**Files:**
- Create: `package.json` (root)
- Create: `packages/worker/package.json`
- Create: `packages/worker/tsconfig.json`
- Create: `packages/worker/wrangler.toml`
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Remove: 旧的顶层 `src/`, `src-tauri/`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json` (保留 docs/)

- [ ] **Step 1: 清理旧 Tauri 结构，保留 docs**

```bash
cd ~/memo-widget
# 保留 docs 和 git 信息，删除 Tauri 相关
rm -rf src src-tauri public node_modules package-lock.json
rm -f vite.config.ts tsconfig.json tsconfig.node.json package.json index.html
```

- [ ] **Step 2: 创建 monorepo root package.json**

创建 `package.json`:

```json
{
  "name": "memo-widget",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:web": "npm run dev -w packages/web",
    "dev:worker": "npm run dev -w packages/worker",
    "build:web": "npm run build -w packages/web",
    "deploy:worker": "npm run deploy -w packages/worker"
  }
}
```

- [ ] **Step 3: 创建 Worker 包**

创建 `packages/worker/package.json`:

```json
{
  "name": "memo-widget-worker",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:init": "wrangler d1 execute memo-widget-db --local --file=./schema.sql",
    "db:init:remote": "wrangler d1 execute memo-widget-db --file=./schema.sql"
  },
  "dependencies": {
    "hono": "^4.4.0",
    "jose": "^5.6.0",
    "web-push": "^3.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240620.0",
    "wrangler": "^3.60.0",
    "typescript": "~5.8.3"
  }
}
```

创建 `packages/worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src"]
}
```

创建 `packages/worker/wrangler.toml`:

```toml
name = "memo-widget-api"
main = "src/index.ts"
compatibility_date = "2024-06-01"

[triggers]
crons = ["* * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "memo-widget-db"
database_id = "placeholder-will-be-filled-after-creation"
```

- [ ] **Step 4: 创建 Web 包**

创建 `packages/web/package.json`:

```json
{
  "name": "memo-widget-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@milkdown/core": "^7.20.0",
    "@milkdown/plugin-listener": "^7.20.0",
    "@milkdown/preset-commonmark": "^7.20.0",
    "@milkdown/react": "^7.20.0",
    "@milkdown/theme-nord": "^7.20.0",
    "dayjs": "^1.11.20",
    "dexie": "^4.0.4",
    "lucide-react": "^1.9.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zustand": "^5.0.12",
    "vite-plugin-pwa": "^0.20.0",
    "workbox-precaching": "^7.1.0",
    "workbox-routing": "^7.1.0",
    "workbox-strategies": "^7.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.0",
    "typescript": "~5.8.3",
    "vite": "^7.0.4"
  }
}
```

创建 `packages/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

创建 `packages/web/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "MemoWidget",
        short_name: "Memo",
        description: "离线优先的备忘录应用",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\//,
            handler: "NetworkFirst",
            options: { cacheName: "api-cache", expiration: { maxEntries: 100, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
```

创建 `packages/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/icon-192.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1a1a2e" />
    <title>MemoWidget</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 安装依赖**

```bash
cd ~/memo-widget
npm install
```

- [ ] **Step 6: 验证结构**

```bash
ls packages/web/node_modules/react packages/worker/node_modules/hono
```

Expected: 两个路径都存在（npm workspaces hoist 到 root 也算）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: restructure as monorepo (web + worker packages)"
```

---

## Task 2: D1 数据库 Schema + Worker 入口

**Files:**
- Create: `packages/worker/schema.sql`
- Create: `packages/worker/src/index.ts`

- [ ] **Step 1: 写 schema.sql**

创建 `packages/worker/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'memo',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_done INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notes_owner ON notes(owner_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_shared ON notes(shared);
```

- [ ] **Step 2: 写 Worker 入口（最小可运行版本）**

创建 `packages/worker/src/index.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";

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

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    // TODO: reminder cron — implemented in Task 8
    ctx.waitUntil(Promise.resolve());
  },
};
```

- [ ] **Step 3: 本地验证 Worker 启动**

```bash
cd packages/worker
npx wrangler d1 create memo-widget-db --local 2>/dev/null || true
npm run db:init
npx wrangler dev --local 2>&1 &
sleep 3
curl http://localhost:8787/api/health
kill %1
```

Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(worker): add D1 schema and Hono app entry point"
```

---

## Task 3: 认证路由 (PIN + JWT)

**Files:**
- Create: `packages/worker/src/middleware/auth.ts`
- Create: `packages/worker/src/routes/auth.ts`
- Modify: `packages/worker/src/index.ts`

- [ ] **Step 1: 写 JWT 中间件**

创建 `packages/worker/src/middleware/auth.ts`:

```typescript
import { Context, Next } from "hono";
import { SignJWT, jwtVerify } from "jose";

interface JWTPayload {
  user_id: string;
  name: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = header.slice(7);
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    c.set("user", payload as unknown as JWTPayload);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

export async function createToken(payload: JWTPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(key);
}
```

- [ ] **Step 2: 写 auth 路由**

创建 `packages/worker/src/routes/auth.ts`:

```typescript
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
```

- [ ] **Step 3: 挂载 auth 路由到主 app**

修改 `packages/worker/src/index.ts`:

```typescript
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
```

- [ ] **Step 4: 验证 auth 路由**

```bash
cd packages/worker
npx wrangler dev --local 2>&1 &
sleep 3
# 检查状态
curl http://localhost:8787/api/auth/status
# 创建用户
curl -X POST http://localhost:8787/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"name":"test","pin":"1234"}'
# 登录
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234"}'
kill %1
```

Expected: status 返回 `{"user_count":0}`，setup 返回 token，login 返回同样 token 格式

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(worker): add auth routes with PIN login and JWT"
```

---

## Task 4: 笔记 CRUD 路由

**Files:**
- Create: `packages/worker/src/routes/notes.ts`
- Modify: `packages/worker/src/index.ts`

- [ ] **Step 1: 写 notes 路由**

创建 `packages/worker/src/routes/notes.ts`:

```typescript
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
    WHERE (n.owner_id = ? OR n.shared = 1)`;
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

notes.put("/reorder", async (c) => {
  const { ids } = await c.req.json<{ ids: string[] }>();
  const batch = ids.map((id, index) =>
    c.env.DB.prepare("UPDATE notes SET sort_order = ?, updated_at = datetime('now') WHERE id = ?").bind(index, id)
  );
  await c.env.DB.batch(batch);
  return c.json({ success: true });
});

export { notes };
```

- [ ] **Step 2: 挂载 notes 路由**

修改 `packages/worker/src/index.ts`，在 `app.route("/api/auth", auth);` 后添加：

```typescript
import { notes } from "./routes/notes";

app.route("/api/notes", notes);
```

- [ ] **Step 3: 验证 CRUD**

```bash
cd packages/worker
npx wrangler dev --local 2>&1 &
sleep 3
# 创建用户拿 token
TOKEN=$(curl -s -X POST http://localhost:8787/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"name":"test","pin":"1234"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
# 创建笔记
curl -X POST http://localhost:8787/api/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"memo","title":"Hello","content":"# World"}'
# 获取笔记
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/notes
kill %1
```

Expected: 创建返回 201 带 id，获取返回数组含该笔记

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(worker): add notes CRUD routes with access control"
```

---

## Task 5: 标签路由

**Files:**
- Create: `packages/worker/src/routes/tags.ts`
- Modify: `packages/worker/src/index.ts`

- [ ] **Step 1: 写 tags 路由**

创建 `packages/worker/src/routes/tags.ts`:

```typescript
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
```

- [ ] **Step 2: 挂载 tags 路由**

修改 `packages/worker/src/index.ts` 添加：

```typescript
import { tags } from "./routes/tags";

app.route("/api/tags", tags);
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(worker): add tags CRUD routes"
```

---

## Task 6: 前端基础框架 (类型 + API Client + IndexedDB)

**Files:**
- Create: `packages/web/src/types.ts`
- Create: `packages/web/src/api/client.ts`
- Create: `packages/web/src/db/index.ts`

- [ ] **Step 1: 类型定义**

创建 `packages/web/src/types.ts`:

```typescript
export interface User {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  owner_id: string;
  shared: boolean;
  type: string;
  title: string;
  content: string;
  is_done: boolean;
  due_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tag_ids: string[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface PendingChange {
  id: string;
  action: "create" | "update" | "delete";
  entity: "note" | "tag";
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}
```

- [ ] **Step 2: API Client**

创建 `packages/web/src/api/client.ts`:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "";

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export function getStoredUser(): { id: string; name: string } | null {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: { id: string; name: string }) {
  localStorage.setItem("user", JSON.stringify(user));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
```

- [ ] **Step 3: IndexedDB 层 (Dexie)**

创建 `packages/web/src/db/index.ts`:

```typescript
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

export async function getLastSync(): Promise<string | null> {
  return localStorage.getItem("last_sync");
}

export function setLastSync(time: string) {
  localStorage.setItem("last_sync", time);
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): add types, API client, and IndexedDB schema"
```

---

## Task 7: 同步引擎

**Files:**
- Create: `packages/web/src/sync/index.ts`

- [ ] **Step 1: 实现同步逻辑**

创建 `packages/web/src/sync/index.ts`:

```typescript
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
  const since = await getLastSync();
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
          await db.notes.put({
            ...note,
            shared: Boolean(note.shared) as unknown as boolean,
            is_done: Boolean(note.is_done) as unknown as boolean,
          });
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(web): add offline sync engine (push/pull/conflict resolution)"
```

---

## Task 8: Zustand Store (连接 DB + Sync)

**Files:**
- Create: `packages/web/src/store/index.ts`

- [ ] **Step 1: 实现 store**

创建 `packages/web/src/store/index.ts`:

```typescript
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
    await db.notes.put(updated);
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(web): add Zustand store with offline-first CRUD and sync"
```

---

## Task 9: 前端 UI 组件

**Files:**
- Create: `packages/web/src/components/PinScreen.tsx`
- Create: `packages/web/src/components/TitleBar.tsx`
- Create: `packages/web/src/components/SpaceTabs.tsx`
- Create: `packages/web/src/components/Toolbar.tsx`
- Create: `packages/web/src/components/NoteList.tsx`
- Create: `packages/web/src/components/NoteItem.tsx`
- Create: `packages/web/src/components/EditView.tsx`
- Create: `packages/web/src/components/MilkdownEditor.tsx`
- Create: `packages/web/src/components/SettingsPanel.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/App.css`
- Create: `packages/web/src/main.tsx`

- [ ] **Step 1: PinScreen**

创建 `packages/web/src/components/PinScreen.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { api } from "../api/client";

export function PinScreen() {
  const { login, setup } = useStore();
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "setup" | "loading">("loading");

  useEffect(() => {
    api.get<{ user_count: number }>("/api/auth/status").then((res) => {
      setMode(res.user_count < 2 ? "setup" : "login");
    }).catch(() => {
      setMode("login");
    });
  }, []);

  const handleLogin = async () => {
    setError("");
    try {
      await login(pin);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSetup = async () => {
    setError("");
    if (!name.trim() || pin.length < 4) {
      setError("请输入名字和至少4位PIN码");
      return;
    }
    try {
      await setup(name, pin);
      setPin("");
      setName("");
      setMode("login");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (mode === "loading") {
    return <div className="pin-screen"><div className="pin-card">加载中...</div></div>;
  }

  return (
    <div className="pin-screen">
      <div className="pin-card">
        <h1>MemoWidget</h1>
        {mode === "setup" ? (
          <>
            <p className="pin-hint">首次使用，请创建用户</p>
            <input
              className="pin-input"
              placeholder="你的名字"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="pin-input"
              type="password"
              placeholder="设置 PIN 码 (4位以上)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={8}
            />
            <button className="pin-btn" onClick={handleSetup}>创建</button>
            <button className="pin-link" onClick={() => setMode("login")}>已有账号？登录</button>
          </>
        ) : (
          <>
            <p className="pin-hint">输入 PIN 码登录</p>
            <input
              className="pin-input"
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              maxLength={8}
              autoFocus
            />
            <button className="pin-btn" onClick={handleLogin}>进入</button>
            <button className="pin-link" onClick={() => setMode("setup")}>新用户注册</button>
          </>
        )}
        {error && <p className="pin-error">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TitleBar**

创建 `packages/web/src/components/TitleBar.tsx`:

```tsx
import { Settings, LogOut } from "lucide-react";
import { useStore } from "../store";

interface Props {
  onOpenSettings: () => void;
}

export function TitleBar({ onOpenSettings }: Props) {
  const { user, logout, syncing } = useStore();

  return (
    <div className="title-bar">
      <span className="title-bar-label">
        MemoWidget
        {syncing && <span className="sync-indicator"> ↻</span>}
      </span>
      <div className="title-bar-actions">
        <span className="user-name">{user?.name}</span>
        <button className="title-btn" onClick={onOpenSettings} title="设置">
          <Settings size={14} />
        </button>
        <button className="title-btn" onClick={logout} title="退出">
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: SpaceTabs**

创建 `packages/web/src/components/SpaceTabs.tsx`:

```tsx
import { useStore } from "../store";

export function SpaceTabs() {
  const { space, setSpace } = useStore();

  return (
    <div className="space-tabs">
      <button
        className={`space-tab ${space === "mine" ? "active" : ""}`}
        onClick={() => setSpace("mine")}
      >
        我的
      </button>
      <button
        className={`space-tab ${space === "shared" ? "active" : ""}`}
        onClick={() => setSpace("shared")}
      >
        共享
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Toolbar**

创建 `packages/web/src/components/Toolbar.tsx`:

```tsx
import { useState } from "react";
import { useStore } from "../store";
import { Plus, Search, X } from "lucide-react";

interface Props {
  onNewNote: () => void;
}

export function Toolbar({ onNewNote }: Props) {
  const { filter, setFilter, searchQuery, setSearchQuery } = useStore();
  const [showSearch, setShowSearch] = useState(false);

  const tabs = [
    { label: "All", value: undefined },
    { label: "Memo", value: "memo" },
    { label: "Todo", value: "todo" },
  ];

  return (
    <div className="toolbar">
      <div className="toolbar-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            className={`tab-btn ${filter.type === tab.value ? "active" : ""}`}
            onClick={() => setFilter({ type: tab.value })}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="toolbar-actions">
        {showSearch ? (
          <div className="search-box">
            <input
              autoFocus
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="icon-btn" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <button className="icon-btn" onClick={() => setShowSearch(true)} title="搜索">
            <Search size={16} />
          </button>
        )}
        <button className="icon-btn add-btn" onClick={onNewNote} title="新建笔记">
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: NoteList + NoteItem (拖拽排序)**

创建 `packages/web/src/components/NoteItem.tsx`:

```tsx
import { Note } from "../types";
import { useStore } from "../store";
import { Check, Circle, Trash2, Clock, Edit3, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import dayjs from "dayjs";

interface Props {
  note: Note;
  onEdit: (id: string) => void;
}

export function NoteItem({ note, onEdit }: Props) {
  const { toggleDone, deleteNote } = useStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`note-item ${note.is_done ? "done" : ""}`}>
      <button className="drag-handle" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <button className="note-check" onClick={() => toggleDone(note.id, !note.is_done)}>
        {note.is_done ? <Check size={14} /> : <Circle size={14} />}
      </button>
      <div className="note-body" onClick={() => onEdit(note.id)}>
        <span className="note-title">{note.title}</span>
        <div className="note-meta">
          {note.due_at && (
            <span className="note-due">
              <Clock size={10} />
              {dayjs(note.due_at).format("MM/DD HH:mm")}
            </span>
          )}
        </div>
      </div>
      <div className="note-actions">
        <button className="icon-btn" onClick={() => onEdit(note.id)} title="编辑">
          <Edit3 size={13} />
        </button>
        <button className="icon-btn danger" onClick={() => deleteNote(note.id)} title="删除">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
```

创建 `packages/web/src/components/NoteList.tsx`:

```tsx
import { useEffect } from "react";
import { useStore } from "../store";
import { NoteItem } from "./NoteItem";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

interface Props {
  onEdit: (id: string) => void;
}

export function NoteList({ onEdit }: Props) {
  const { notes, loading, loadNotes, loadTags, reorderNotes } = useStore();

  useEffect(() => {
    loadNotes();
    loadTags();
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = notes.findIndex((n) => n.id === active.id);
    const newIndex = notes.findIndex((n) => n.id === over.id);
    const reordered = arrayMove(notes, oldIndex, newIndex);
    reorderNotes(reordered.map((n) => n.id));
  };

  if (loading && notes.length === 0) return <div className="empty-state">加载中...</div>;
  if (notes.length === 0) return <div className="empty-state">暂无笔记，点击 + 创建</div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="note-list">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} onEdit={onEdit} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 6: MilkdownEditor**

创建 `packages/web/src/components/MilkdownEditor.tsx`:

```tsx
import { useEditor, Milkdown, MilkdownProvider } from "@milkdown/react";
import { commonmark } from "@milkdown/preset-commonmark";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { nord } from "@milkdown/theme-nord";

interface Props {
  defaultValue: string;
  onChange: (markdown: string) => void;
}

function EditorInner({ defaultValue, onChange }: Props) {
  useEditor((container) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, defaultValue);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChange(markdown);
        });
      })
      .config(nord)
      .use(commonmark)
      .use(listener);
  }, [defaultValue]);

  return <Milkdown />;
}

export function MilkdownEditor(props: Props) {
  return (
    <MilkdownProvider>
      <div className="milkdown-wrapper">
        <EditorInner {...props} />
      </div>
    </MilkdownProvider>
  );
}
```

- [ ] **Step 7: EditView**

创建 `packages/web/src/components/EditView.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { db } from "../db";
import { Note, Tag } from "../types";
import { Save, ArrowLeft, Clock, Tag as TagIcon } from "lucide-react";
import { MilkdownEditor } from "./MilkdownEditor";
import dayjs from "dayjs";

interface Props {
  noteId: string | null;
  onBack: () => void;
}

export function EditView({ noteId, onBack }: Props) {
  const { createNote, updateNote, tags, space } = useStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("memo");
  const [shared, setShared] = useState(space === "shared");
  const [dueAt, setDueAt] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (noteId) {
      db.notes.get(noteId).then((note: Note | undefined) => {
        if (note) {
          setTitle(note.title);
          setContent(note.content);
          setNoteType(note.type);
          setShared(Boolean(note.shared));
          setDueAt(note.due_at || "");
          setSelectedTags(note.tag_ids || []);
        }
        setReady(true);
      });
    } else {
      setReady(true);
    }
  }, [noteId]);

  const save = async () => {
    setSaving(true);
    if (noteId) {
      await updateNote(noteId, { title, content, type: noteType, shared, due_at: dueAt || null, tag_ids: selectedTags });
    } else {
      await createNote({ type: noteType, title, content, shared, due_at: dueAt || undefined, tag_ids: selectedTags });
    }
    setSaving(false);
    onBack();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);
  };

  return (
    <div className="edit-view">
      <div className="edit-header">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={18} /></button>
        <h2>{noteId ? "编辑笔记" : "新建笔记"}</h2>
        <div />
      </div>
      <div className="edit-form">
        <div className="form-row type-row">
          <button className={`type-btn ${noteType === "memo" ? "active" : ""}`} onClick={() => setNoteType("memo")}>备忘</button>
          <button className={`type-btn ${noteType === "todo" ? "active" : ""}`} onClick={() => setNoteType("todo")}>待办</button>
          <span className="spacer" />
          <label className="shared-toggle">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            <span>共享</span>
          </label>
        </div>

        <input className="edit-title" placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />

        {ready && <MilkdownEditor defaultValue={content} onChange={(md) => setContent(md)} />}

        <div className="form-row">
          <Clock size={14} />
          <input
            type="datetime-local"
            value={dueAt ? dayjs(dueAt).format("YYYY-MM-DDTHH:mm") : ""}
            onChange={(e) => setDueAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
          />
        </div>

        {tags.length > 0 && (
          <div className="form-row tags-row">
            <TagIcon size={14} />
            <div className="tag-choices">
              {tags.map((tag: Tag) => (
                <button
                  key={tag.id}
                  className={`tag-chip ${selectedTags.includes(tag.id) ? "selected" : ""}`}
                  style={{ borderColor: tag.color, backgroundColor: selectedTags.includes(tag.id) ? tag.color : "transparent" }}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="save-btn" onClick={save} disabled={!title.trim() || saving}>
          <Save size={14} />
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: SettingsPanel**

创建 `packages/web/src/components/SettingsPanel.tsx`:

```tsx
import { useState } from "react";
import { useStore } from "../store";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const { tags, createTag, deleteTag } = useStore();
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#e94560");

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    await createTag(newTagName, newTagColor);
    setNewTagName("");
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>设置</h2>
        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="settings-form">
        <h3>标签管理</h3>
        <div className="tag-list">
          {tags.map((tag) => (
            <div key={tag.id} className="tag-row">
              <span className="tag-chip selected" style={{ backgroundColor: tag.color }}>{tag.name}</span>
              <button className="icon-btn danger" onClick={() => deleteTag(tag.id)}>×</button>
            </div>
          ))}
        </div>
        <div className="form-row">
          <input placeholder="标签名" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
          <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
          <button className="type-btn active" onClick={handleCreateTag}>添加</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: App.tsx + main.tsx**

创建 `packages/web/src/App.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useStore } from "./store";
import { PinScreen } from "./components/PinScreen";
import { TitleBar } from "./components/TitleBar";
import { SpaceTabs } from "./components/SpaceTabs";
import { Toolbar } from "./components/Toolbar";
import { NoteList } from "./components/NoteList";
import { EditView } from "./components/EditView";
import { SettingsPanel } from "./components/SettingsPanel";
import "./App.css";

function App() {
  const { user, restoreSession, sync } = useStore();
  const [view, setView] = useState<"list" | "edit" | "settings">("list");
  const [editNoteId, setEditNoteId] = useState<string | null>(null);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (user) {
      sync();
      const interval = setInterval(sync, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return <PinScreen />;

  if (view === "edit") {
    return <EditView noteId={editNoteId} onBack={() => { setView("list"); setEditNoteId(null); }} />;
  }

  if (view === "settings") {
    return <SettingsPanel onClose={() => setView("list")} />;
  }

  return (
    <div className="app-shell">
      <TitleBar onOpenSettings={() => setView("settings")} />
      <SpaceTabs />
      <Toolbar onNewNote={() => { setEditNoteId(null); setView("edit"); }} />
      <NoteList onEdit={(id) => { setEditNoteId(id); setView("edit"); }} />
    </div>
  );
}

export default App;
```

创建 `packages/web/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(web): add all UI components (PIN, notes, editor, settings)"
```

---

## Task 10: CSS 样式

**Files:**
- Create: `packages/web/src/App.css`

- [ ] **Step 1: 写完整样式**

复用之前的暗色主题，新增 PinScreen、SpaceTabs、共享标记等样式。完整文件内容较长，基于现有 `App.css` 添加：

- `.pin-screen` — 全屏居中卡片
- `.pin-card` — 带圆角阴影的登录卡片
- `.pin-input` / `.pin-btn` — 输入框和按钮
- `.space-tabs` / `.space-tab` — 我的/共享 切换栏
- `.sync-indicator` — 同步中动画
- `.user-name` — 标题栏用户名
- `.shared-toggle` — 编辑页的共享开关
- 其余样式复用现有 (title-bar, toolbar, note-item, note-list, edit-view, milkdown-wrapper, settings-panel, drag-handle 等)

详细 CSS 见现有 src/App.css 已有的所有规则，加上以下新增部分：

```css
/* PIN Screen */
.pin-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg);
}

.pin-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  width: 280px;
}

.pin-card h1 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}

.pin-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.pin-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius);
  font-size: 14px;
  text-align: center;
  outline: none;
}

.pin-input:focus { border-color: var(--accent); }

.pin-btn {
  width: 100%;
  padding: 10px;
  border: none;
  background: var(--accent);
  color: white;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.pin-btn:hover { opacity: 0.9; }

.pin-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

.pin-error {
  color: var(--accent);
  font-size: 12px;
}

/* Space Tabs */
.space-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}

.space-tab {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.space-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* Misc */
.sync-indicator {
  font-size: 11px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.user-name {
  font-size: 11px;
  color: var(--text-muted);
  margin-right: 4px;
}

.shared-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
}

.shared-toggle input { accent-color: var(--accent); }

.spacer { flex: 1; }

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-form h3 {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.settings-form input:not([type="color"]) {
  padding: 6px 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: var(--radius);
  font-size: 12px;
  outline: none;
  flex: 1;
}

.settings-form input[type="color"] {
  width: 32px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2px;
  cursor: pointer;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(web): add complete dark theme CSS"
```

---

## Task 11: PWA 图标 + Manifest + 验证构建

**Files:**
- Create: `packages/web/public/icon-192.png`
- Create: `packages/web/public/icon-512.png`

- [ ] **Step 1: 生成简单 SVG 图标占位**

```bash
cd packages/web/public
# 用 ImageMagick 或简单脚本生成纯色方块图标作为占位
# 如果没有 imagemagick，直接创建一个最小 PNG
python3 -c "
import struct, zlib
def create_png(w, h, color, path):
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''
    for _ in range(h):
        raw += b'\x00' + bytes(color) * w
    data = b'\x89PNG\r\n\x1a\n'
    data += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(raw))
    data += chunk(b'IEND', b'')
    with open(path, 'wb') as f: f.write(data)
create_png(192, 192, (26, 26, 46), 'icon-192.png')
create_png(512, 512, (26, 26, 46), 'icon-512.png')
print('Icons created')
"
```

- [ ] **Step 2: 验证前端构建**

```bash
cd ~/memo-widget
npm run build:web
```

Expected: 构建成功，输出 `dist/` 包含 index.html, assets/, manifest.webmanifest

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(web): add PWA icons and verify build"
```

---

## Task 12: 推送通知 (Cron + Web Push)

**Files:**
- Create: `packages/worker/src/routes/push.ts`
- Create: `packages/worker/src/cron/reminders.ts`
- Modify: `packages/worker/src/index.ts`

- [ ] **Step 1: 推送订阅路由**

创建 `packages/worker/src/routes/push.ts`:

```typescript
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
```

- [ ] **Step 2: Cron 提醒逻辑**

创建 `packages/worker/src/cron/reminders.ts`:

```typescript
interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

export async function handleReminders(env: Env): Promise<void> {
  const now = new Date().toISOString();

  const { results: dueNotes } = await env.DB.prepare(
    `SELECT n.id, n.title, n.owner_id, n.due_at
     FROM notes n
     WHERE n.due_at IS NOT NULL AND n.due_at <= ? AND n.deleted_at IS NULL AND n.is_done = 0`
  ).bind(now).all();

  if (!dueNotes || dueNotes.length === 0) return;

  for (const note of dueNotes) {
    const { results: subs } = await env.DB.prepare(
      "SELECT subscription FROM push_subscriptions WHERE user_id = ?"
    ).bind(note.owner_id as string).all();

    if (subs) {
      for (const sub of subs) {
        try {
          const subscription = JSON.parse(sub.subscription as string);
          const payload = JSON.stringify({
            title: "⏰ 提醒",
            body: note.title as string,
            data: { noteId: note.id },
          });

          await fetch(subscription.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: payload,
          });
        } catch (err) {
          console.error("Push failed:", err);
        }
      }
    }

    await env.DB.prepare("UPDATE notes SET due_at = NULL, updated_at = datetime('now') WHERE id = ?")
      .bind(note.id as string).run();
  }
}
```

- [ ] **Step 3: 挂载 push 路由和 cron handler**

修改 `packages/worker/src/index.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./routes/auth";
import { notes } from "./routes/notes";
import { tags } from "./routes/tags";
import { push } from "./routes/push";
import { handleReminders } from "./cron/reminders";

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
app.route("/api/notes", notes);
app.route("/api/tags", tags);
app.route("/api/push", push);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(handleReminders(env));
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(worker): add push subscription routes and cron reminder handler"
```

---

## Task 13: 端到端验证

- [ ] **Step 1: Worker 本地运行**

```bash
cd ~/memo-widget/packages/worker
npm run db:init
npx wrangler dev --local &
sleep 3
```

- [ ] **Step 2: 前端本地运行**

```bash
cd ~/memo-widget/packages/web
npm run dev &
sleep 3
```

- [ ] **Step 3: 测试完整流程**

```bash
# 在浏览器中打开 http://localhost:5173
# 1. 看到 PIN 登录页
# 2. 注册用户
# 3. 创建笔记
# 4. 切换共享空间
# 5. 搜索笔记
# 由于我们在 headless 环境，用 curl 验证 API 工作正常：
TOKEN=$(curl -s -X POST http://localhost:8787/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"name":"用户A","pin":"1111"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "Token: $TOKEN"
curl -s -X POST http://localhost:8787/api/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"memo","title":"第一条笔记","content":"# Hello World","shared":true}'
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/notes | python3 -m json.tool
```

Expected: API 返回包含 "第一条笔记" 的数据

- [ ] **Step 4: 停止服务，Commit**

```bash
kill %1 %2 2>/dev/null
git add -A
git commit -m "chore: verify end-to-end local development setup"
```

---

## Task 14: 部署配置

- [ ] **Step 1: 添加 .gitignore**

创建根目录 `.gitignore`:

```
node_modules/
dist/
.wrangler/
.dev.vars
*.local
```

- [ ] **Step 2: Worker 环境变量模板**

创建 `packages/worker/.dev.vars`:

```
JWT_SECRET=your-dev-secret-change-in-production
VAPID_PUBLIC_KEY=placeholder
VAPID_PRIVATE_KEY=placeholder
```

- [ ] **Step 3: 更新 README**

创建 `README.md`（简要说明如何开发和部署）：

```markdown
# MemoWidget

离线优先的备忘录 PWA 应用。

## 开发

npm install
npm run dev:worker  # 启动 API (localhost:8787)
npm run dev:web     # 启动前端 (localhost:5173)

## 部署

1. Cloudflare Dashboard 创建 D1 数据库，将 ID 填入 wrangler.toml
2. `npm run deploy:worker` 部署 API
3. Cloudflare Pages 连接 GitHub repo，build command: `npm run build:web`，output: `packages/web/dist`
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add deployment config, gitignore, and README"
```

---

## 实施顺序总结

| Task | 内容 | 依赖 |
|------|------|------|
| 1 | Monorepo 脚手架 | 无 |
| 2 | D1 Schema + Worker 入口 | 1 |
| 3 | 认证路由 | 2 |
| 4 | 笔记 CRUD 路由 | 3 |
| 5 | 标签路由 | 3 |
| 6 | 前端基础 (类型+API+DB) | 1 |
| 7 | 同步引擎 | 6 |
| 8 | Zustand Store | 6, 7 |
| 9 | UI 组件 | 8 |
| 10 | CSS 样式 | 9 |
| 11 | PWA 图标 + 构建验证 | 10 |
| 12 | 推送通知 | 4 |
| 13 | 端到端验证 | 全部 |
| 14 | 部署配置 | 13 |
