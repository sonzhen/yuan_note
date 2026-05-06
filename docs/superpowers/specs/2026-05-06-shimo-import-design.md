# Shimo Document Import Design

## Problem

User has existing documents in Shimo (石墨文档) that need to be brought into YuanNote. Currently there's no way to import external documents.

## Scope

One-time batch import of .docx and .md files exported from Shimo. Pure client-side parsing. No Shimo API integration, no ongoing sync.

## Architecture

```
User selects files (.docx/.md)
  → Frontend parses each file
    → .docx: mammoth.js → HTML
    → .md: marked → HTML
  → File name (minus extension) becomes title
  → User-selected type (memo/todo) applied to all
  → store.createNote() for each file
  → Normal sync pushes to backend
```

All processing happens in the browser. No backend changes needed.

## Dependencies

- New: `mammoth` (docx → HTML conversion, ~80KB gzipped)
- Existing: `marked` (Markdown → HTML)

## UI

### Entry Points

1. **SettingsPanel** — "导入文档" button at the bottom of settings
2. **EditView** — "从文件导入" link button next to the type selector row

Both open the same ImportView component.

### ImportView Flow

A full-screen panel (same pattern as EditView/SettingsPanel):

1. Header: back button + "导入文档" title
2. Type selector: memo / todo toggle (default memo)
3. File picker: button opening native file dialog, `accept=".docx,.md"`, `multiple`
4. File list: shows selected files (name + size + remove button per file)
5. "开始导入" button at bottom
6. Progress: "正在导入 3/5..." during processing
7. Result: "成功导入 N 条笔记" + "完成" button → returns to note list

State-driven view switching within the component, no routing needed.

## File Parsing

### .docx (mammoth.js)

```ts
import mammoth from "mammoth";

const result = await mammoth.convertToHtml({ arrayBuffer });
const html = result.value; // HTML string
```

mammoth preserves: bold, italic, headings, lists, tables, links, images (as base64 data URLs).

### .md (marked)

```ts
import { marked } from "marked";

const html = await marked(text);
```

Image links in Markdown preserved as-is (external URLs).

### Title Extraction

Strip file extension from filename:
- `"工作规划.docx"` → `"工作规划"`
- `"meeting-notes.md"` → `"meeting-notes"`

## Error Handling

- **Unsupported file type:** `accept` attribute prevents most cases. If bypassed, check extension before parsing; skip unsupported files with a count in the result message.
- **Parse failure:** Catch errors from mammoth/marked per file. Skip failed files, continue with others. Show "N 个文件解析失败" in result.
- **Empty files:** Create note with empty content (title still valid).
- **Large files:** No hard limit. Shimo exports are typically < 1MB per document.
- **Duplicate titles:** No deduplication. User can rename or delete after import.

## Files to Create/Modify

- Create: `packages/web/src/components/ImportView.tsx` — the import UI panel
- Create: `packages/web/src/utils/fileParser.ts` — docx/md parsing logic
- Modify: `packages/web/src/components/SettingsPanel.tsx` — add import button
- Modify: `packages/web/src/components/EditView.tsx` — add "从文件导入" link
- Modify: `packages/web/src/App.tsx` — add "import" view state
- Modify: `packages/web/src/App.css` — import view styles
- Modify: `packages/web/package.json` — add mammoth dependency
