# YuanNote

一个轻量级 PWA 备忘录/待办应用，支持离线使用、多设备同步、Markdown 编辑。

## 特性

- PIN 码登录，最多支持 2 个用户
- 私人空间 + 共享空间
- Memo（备忘）和 Todo（待办）两种类型
- Markdown 富文本编辑（Milkdown）
- 图片插入支持
- 拖拽排序
- 标签分类
- 离线优先，联网自动同步
- 自动保存（3 秒无操作）+ Ctrl+S 手动保存
- PWA 安装到主屏幕
- 暗色主题

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript + Vite |
| 编辑器 | Milkdown (ProseMirror) |
| 离线存储 | IndexedDB (Dexie.js) |
| 状态管理 | Zustand |
| 后端 | Cloudflare Workers + Hono |
| 数据库 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Pages + Workers |

## 项目结构

```
packages/
  web/       # 前端 PWA (React + Vite)
  worker/    # 后端 API (Hono + D1)
```

## 访问地址

https://yuannote.pages.dev

## 本地开发

```bash
npm install
npm run dev:web      # 启动前端 dev server (localhost:5173)
npm run dev:worker   # 启动后端 dev server (localhost:8787)
```

## 部署

前端通过 Cloudflare Pages 部署，后端通过 Workers 部署。

```bash
# 前端部署
cd packages/web
VITE_API_URL="" npm run build
npx wrangler pages deploy dist --project-name=yuannote --branch=main

# 后端部署
npx esbuild packages/worker/src/index.ts --bundle --format=esm --outfile=packages/worker/dist/index.js
# 通过 Cloudflare REST API 上传
```
