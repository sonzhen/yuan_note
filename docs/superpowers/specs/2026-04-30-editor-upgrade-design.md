# YuanNote 编辑器升级设计

## 概述

将编辑器从 Milkdown (Markdown-only) 升级为 Tiptap (HTML 富文本)，支持完整的富文本编辑功能，对标石墨文档/WPS 的编辑体验。

## 编辑器架构

- **框架**: Tiptap v2 (基于 ProseMirror)
- **存储格式**: HTML 字符串存入 D1 的 `content` 字段
- **Markdown 快捷输入**: `#` → 标题、`>` → 引用、`-` → 列表、`---` → 分割线、`` ` `` → 代码等 (Tiptap InputRules 内置)

## 工具栏设计

### 顶部固定工具栏（插入型操作）

一行图标按钮，始终可见：

```
[表格] [图片] [代码块] [分割线] [引用] [有序列表] [无序列表] [待办] [缩进+] [缩进-] [对齐▾]
```

### 浮动气泡工具栏（选中文字时弹出）

选中文字后在上方弹出，格式化文字：

```
[B] [I] [U] [S] [颜色▾] [高亮▾] [字号▾] [链接]
```

## 功能清单

### 文字格式
- 加粗、斜体、下划线、删除线
- 文字颜色（预设调色板 + 自定义）
- 文字高亮/背景色
- 字号（4档：小12px / 正常14px / 大18px / 超大24px）

### 结构元素
- 表格（插入、增删行列、合并单元格）
- 有序/无序列表
- 缩进（增加/减少层级）
- 引用块
- 分割线
- 代码块

### 其他
- 待办清单（checkbox）
- 链接（插入/编辑）
- 对齐方式（左/中/右）
- 图片插入

### Markdown 快捷输入
- `# ` → H1, `## ` → H2, `### ` → H3
- `> ` → 引用
- `- ` 或 `* ` → 无序列表
- `1. ` → 有序列表
- `[] ` → 待办
- `---` → 分割线
- ``` ` ``` → 行内代码
- ```` ``` ```` → 代码块

## 数据迁移策略

按需逐条迁移，无批量操作：

```
笔记加载时:
  if (content 以 '<' 开头 或 为空) → 已是 HTML，直接使用
  else → 用 marked 库将 Markdown 转为 HTML，保存时写回新格式
```

## 依赖变更

### 移除
- `@milkdown/core`
- `@milkdown/plugin-listener`
- `@milkdown/preset-commonmark`
- `@milkdown/react`
- `@milkdown/theme-nord`

### 新增
- `@tiptap/react`
- `@tiptap/starter-kit`
- `@tiptap/extension-table`
- `@tiptap/extension-table-row`
- `@tiptap/extension-table-cell`
- `@tiptap/extension-table-header`
- `@tiptap/extension-color`
- `@tiptap/extension-text-style`
- `@tiptap/extension-highlight`
- `@tiptap/extension-text-align`
- `@tiptap/extension-underline`
- `@tiptap/extension-link`
- `@tiptap/extension-image`
- `@tiptap/extension-task-list`
- `@tiptap/extension-task-item`
- `@tiptap/extension-placeholder`
- `marked`

## 组件结构

```
components/
  editor/
    TiptapEditor.tsx        # 主编辑器组件 (forwardRef, 暴露 insertImage)
    Toolbar.tsx             # 顶部固定工具栏
    BubbleToolbar.tsx       # 浮动气泡工具栏
    ColorPicker.tsx         # 颜色选择弹出框
    FontSizePicker.tsx      # 字号选择
    extensions/
      FontSize.ts           # 自定义字号扩展
      Indent.ts             # 自定义缩进扩展
```

## 样式

- 编辑器内容区域继承现有暗色主题变量
- 工具栏按钮使用统一的 icon-btn 风格
- 浮动工具栏半透明深色背景 + 圆角
- 表格边框使用 var(--border) 颜色
- 代码块使用 var(--surface) 背景

## 键盘快捷键

- `Ctrl+B` 加粗
- `Ctrl+I` 斜体
- `Ctrl+U` 下划线
- `Ctrl+Shift+S` 删除线
- `Ctrl+S` 保存（已有）
- `Tab` 缩进 / `Shift+Tab` 减少缩进
- `Ctrl+Shift+7` 有序列表
- `Ctrl+Shift+8` 无序列表
