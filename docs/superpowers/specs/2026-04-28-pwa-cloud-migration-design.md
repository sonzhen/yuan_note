# MemoWidget PWA + Cloudflare 架构改造设计

## 概述

将现有 Tauri 桌面应用改造为 PWA + Cloudflare 云端架构，实现：
- 任何设备（PC/手机）通过浏览器即可使用
- 离线优先，断网可读写，联网自动同步
- 两人使用（各自 PIN 登录），个人笔记 + 共享空间
- 无需维护服务器，全部运行在 Cloudflare 免费层

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React + TypeScript + Vite | 复用现有组件 |
| UI | 暗色主题 + Milkdown 编辑器 | 复用现有样式 |
| 状态管理 | Zustand | 复用现有 store |
| 离线存储 | IndexedDB (via Dexie.js) | 本地缓存 |
| 部署 | Cloudflare Pages | 免费静态托管 |
| API | Cloudflare Workers (Hono框架) | 轻量 REST API |
| 数据库 | Cloudflare D1 (SQLite) | 5GB 免费 |
| 推送 | Web Push + Cron Trigger | 定时检查提醒 |

## 架构图

```
┌─────────────────────────────────────────────┐
│  浏览器 / 手机浏览器 (PWA)                    │
│  ┌───────────┐  ┌──────────────────────┐    │
│  │ IndexedDB │←→│ React SPA (暗色主题) │    │
│  │ 离线缓存   │  │ Milkdown 编辑器      │    │
│  └───────────┘  └──────────────────────┘    │
└─────────────────┬───────────────────────────┘
                  │ HTTPS (同步)
┌─────────────────▼───────────────────────────┐
│  Cloudflare Workers (Hono API)               │
│  - PIN 验证 + JWT token                      │
│  - 笔记 CRUD / 搜索 / 排序                   │
│  - Web Push 提醒                             │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Cloudflare D1 (SQLite)                      │
│  - users / notes / tags / reminders          │
└─────────────────────────────────────────────┘
```

## 数据模型

### users

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 显示名 |
| pin_hash | TEXT | bcrypt 哈希 |
| created_at | TEXT | ISO 时间 |

### notes

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| owner_id | TEXT FK | 创建者 |
| shared | INTEGER | 1=共享, 0=私人 |
| type | TEXT | "memo" / "todo" |
| title | TEXT | 标题 |
| content | TEXT | Markdown 内容 |
| is_done | INTEGER | 0/1 |
| due_at | TEXT | 提醒时间(ISO) |
| sort_order | INTEGER | 排序 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 修改时间 |
| deleted_at | TEXT | 软删除时间(null=未删) |

### tags

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 标签名 |
| color | TEXT | 颜色值 |

### note_tags

| 字段 | 类型 |
|------|------|
| note_id | TEXT FK |
| tag_id | TEXT FK |

### push_subscriptions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_id | TEXT FK | 所属用户 |
| subscription | TEXT | Web Push subscription JSON |
| created_at | TEXT | 注册时间 |

## API 接口

所有接口前缀 `/api`，除 auth 接口外均需 `Authorization: Bearer <JWT>`。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/setup | 初始化用户 `{name, pin}` |
| POST | /api/auth/login | PIN 登录 `{pin}` → `{token, user}` |

### 笔记

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/notes?since=ISO时间 | 增量同步（返回该时间后更新的所有笔记） |
| POST | /api/notes | 创建笔记 |
| PUT | /api/notes/:id | 更新笔记 |
| DELETE | /api/notes/:id | 软删除笔记 |
| PUT | /api/notes/reorder | 批量更新排序 `{ids: [...]}` |

### 标签

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tags | 获取所有标签 |
| POST | /api/tags | 创建标签 |
| DELETE | /api/tags/:id | 删除标签 |

### 推送

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/push/subscribe | 注册推送订阅 |
| DELETE | /api/push/subscribe | 取消订阅 |

## 访问控制

- JWT payload 包含 `{user_id, name}`
- GET /api/notes 返回：`owner_id = 当前用户 OR shared = 1` 的笔记
- PUT/DELETE 笔记：私人笔记仅 owner 可操作，共享笔记两人都可操作
- 标签全局共享，两人都能增删

## 离线同步策略

### 本地存储 (IndexedDB via Dexie.js)

- 完整笔记副本
- 未同步操作队列 (pending_changes)
- 上次同步时间戳 (last_sync)

### 同步流程

1. **打开 App** → 先渲染 IndexedDB 数据（秒开）
2. **后台同步** → `GET /api/notes?since=last_sync` 拉取增量
3. **编辑操作** → 先写 IndexedDB，加入 pending_changes 队列
4. **联网时** → 逐条推送 pending_changes 到云端
5. **冲突解决** → Last-Write-Wins（以 updated_at 较新者为准）

### 软删除

笔记不做物理删除，使用 `deleted_at` 标记。同步时客户端根据此字段从本地移除。30 天后 Cron 清理物理删除。

## 前端页面

### 路由

| 路径 | 页面 |
|------|------|
| / | PIN 输入页（未登录）/ 主界面（已登录）|
| /edit/:id | 编辑笔记 |
| /edit/new | 新建笔记 |

### 主界面布局

```
┌─────────────────────────────┐
│ TitleBar  [设置]  [—] [×]   │
├─────────────────────────────┤
│ [我的] [共享]               │  ← 空间切换
├─────────────────────────────┤
│ [All] [Memo] [Todo]  🔍 [+]│  ← 工具栏
├─────────────────────────────┤
│ ≡ ○ 笔记标题        ✎ 🗑   │
│     #tag  ⏰ 04/30 10:00    │
│ ≡ ● 已完成的待办     ✎ 🗑   │
│ ≡ ○ 另一条笔记       ✎ 🗑   │
│         ...                  │
└─────────────────────────────┘
```

### 与 Tauri 版差异

| 功能 | Tauri 版 | PWA 版 |
|------|---------|--------|
| 系统托盘 | ✓ | ✗ (Web不支持) |
| 全局热键 | ✓ | ✗ |
| Always-on-top | ✓ | ✗ |
| 独立编辑窗口 | ✓ | 改为路由跳转 |
| PIN 保护 | ✗ | ✓ |
| 多人空间 | ✗ | ✓ |
| 离线使用 | ✓ (本地应用) | ✓ (Service Worker + IndexedDB) |
| 推送通知 | 系统通知 | Web Push |
| 安装到桌面/手机 | 安装包 | PWA "添加到主屏幕" |

## PWA 配置

### manifest.json

- `display: "standalone"` — 全屏独立应用体验
- `theme_color: "#1a1a2e"` — 暗色主题色
- 图标 192x192 + 512x512

### Service Worker

- 缓存策略：静态资源 Cache First，API 请求 Network First
- 后台同步：利用 Background Sync API 推送离线操作

## 提醒推送

1. 用户设置提醒 → 前端注册 Web Push subscription → 存入 D1
2. Cloudflare Cron Trigger 每分钟执行一次
3. 检查 `due_at <= now` 且未推送的提醒
4. 通过 Web Push 协议发送通知
5. 标记提醒已发送

## 项目结构

```
memo-widget/
├── packages/
│   ├── web/                  # 前端 (React + Vite PWA)
│   │   ├── src/
│   │   │   ├── components/   # 复用并改造现有组件
│   │   │   ├── store/        # Zustand store
│   │   │   ├── db/           # Dexie.js IndexedDB 层
│   │   │   ├── sync/         # 同步逻辑
│   │   │   └── sw.ts         # Service Worker
│   │   ├── public/
│   │   │   └── manifest.json
│   │   └── vite.config.ts
│   └── worker/               # 后端 (Cloudflare Workers)
│       ├── src/
│       │   ├── routes/       # API 路由 (Hono)
│       │   ├── middleware/   # JWT 验证
│       │   └── cron/         # 定时提醒任务
│       ├── schema.sql        # D1 数据库 schema
│       └── wrangler.toml     # Workers 配置
├── package.json              # monorepo root
└── docs/
```

## 部署流程

1. GitHub push → Cloudflare Pages 自动构建前端
2. GitHub push → Cloudflare Workers 自动部署 API
3. 首次部署后运行 `wrangler d1 execute` 初始化数据库 schema
4. 首次打开 App → 进入 setup 页面创建两个用户
