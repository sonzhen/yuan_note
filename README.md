# MemoWidget

离线优先的备忘录 PWA 应用。支持双人使用（PIN 登录）、个人/共享笔记空间、Markdown 编辑、拖拽排序、提醒推送。

## 技术栈

- 前端: React 19 + TypeScript + Vite + PWA
- 后端: Cloudflare Workers + Hono
- 数据库: Cloudflare D1 (SQLite)
- 离线: IndexedDB (Dexie.js) + 增量同步

## 开发

```bash
npm install
npm run dev:worker  # 启动 API (localhost:8787)
npm run dev:web     # 启动前端 (localhost:5173)
```

## 部署

1. 在 Cloudflare Dashboard 创建 D1 数据库，将 database_id 填入 `packages/worker/wrangler.toml`
2. 设置 Worker secrets: `wrangler secret put JWT_SECRET`
3. 初始化数据库: `npm run db:init:remote -w packages/worker`
4. 部署 Worker: `npm run deploy:worker`
5. 部署前端: Cloudflare Pages 连接 GitHub，build command: `npm run build:web`，output: `packages/web/dist`
