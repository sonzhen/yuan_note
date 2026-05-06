# Shimo Document Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to batch-import .docx and .md files (exported from Shimo) into YuanNote as notes, with client-side parsing.

**Architecture:** A new ImportView component handles file selection, type choice, and progress display. A fileParser utility handles the actual parsing (mammoth for .docx, marked for .md). Entry points are added in SettingsPanel and EditView. App.tsx gains an "import" view state.

**Tech Stack:** React 19, mammoth (new dep), marked (existing), Zustand store (existing createNote)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/web/src/utils/fileParser.ts` | NEW — Parse .docx/.md files to {title, html} |
| `packages/web/src/components/ImportView.tsx` | NEW — Full-screen import UI panel |
| `packages/web/src/App.tsx` | Add "import" view state |
| `packages/web/src/App.css` | Import view styles |
| `packages/web/src/components/SettingsPanel.tsx` | Add "导入文档" button |
| `packages/web/src/components/EditView.tsx` | Add "从文件导入" link |
| `packages/web/package.json` | Add mammoth dependency |
| `packages/web/src/__tests__/fileParser.test.ts` | NEW — Unit tests for parsing logic |

---

### Task 1: Install mammoth and create fileParser utility

**Files:**
- Modify: `packages/web/package.json`
- Create: `packages/web/src/utils/fileParser.ts`
- Create: `packages/web/src/__tests__/fileParser.test.ts`

- [ ] **Step 1: Install mammoth**

```bash
cd /home/sonzhen/memo-widget/packages/web && npm install mammoth
```

- [ ] **Step 2: Create fileParser.ts**

Create `packages/web/src/utils/fileParser.ts`:

```ts
import mammoth from "mammoth";
import { marked } from "marked";

export interface ParsedFile {
  title: string;
  html: string;
}

function extractTitle(filename: string): string {
  return filename.replace(/\.(docx|md)$/i, "");
}

async function parseDocx(file: File): Promise<ParsedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return { title: extractTitle(file.name), html: result.value };
}

async function parseMarkdown(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const html = await marked(text);
  return { title: extractTitle(file.name), html };
}

export interface ParseResult {
  success: ParsedFile[];
  failed: string[];
  skipped: string[];
}

export async function parseFiles(files: File[]): Promise<ParseResult> {
  const success: ParsedFile[] = [];
  const failed: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "docx") {
      try {
        const parsed = await parseDocx(file);
        success.push(parsed);
      } catch {
        failed.push(file.name);
      }
    } else if (ext === "md") {
      try {
        const parsed = await parseMarkdown(file);
        success.push(parsed);
      } catch {
        failed.push(file.name);
      }
    } else {
      skipped.push(file.name);
    }
  }

  return { success, failed, skipped };
}
```

- [ ] **Step 3: Write tests for fileParser**

Create `packages/web/src/__tests__/fileParser.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { parseFiles } from "../utils/fileParser";

function createMockFile(name: string, content: string, type = "text/plain"): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

describe("parseFiles", () => {
  it("parses .md files to HTML", async () => {
    const file = createMockFile("test.md", "# Hello\n\nWorld");
    const result = await parseFiles([file]);
    expect(result.success).toHaveLength(1);
    expect(result.success[0].title).toBe("test");
    expect(result.success[0].html).toContain("<h1>");
    expect(result.success[0].html).toContain("Hello");
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("extracts title from filename without extension", async () => {
    const file = createMockFile("工作规划.md", "content");
    const result = await parseFiles([file]);
    expect(result.success[0].title).toBe("工作规划");
  });

  it("skips unsupported file types", async () => {
    const file = createMockFile("photo.png", "binary data");
    const result = await parseFiles([file]);
    expect(result.success).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toBe("photo.png");
  });

  it("handles multiple files with mixed types", async () => {
    const md = createMockFile("notes.md", "# Notes");
    const txt = createMockFile("readme.txt", "text");
    const result = await parseFiles([md, txt]);
    expect(result.success).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it("reports failed files without stopping others", async () => {
    const good = createMockFile("good.md", "# Works");
    const bad = createMockFile("bad.docx", "not a real docx");
    const result = await parseFiles([good, bad]);
    expect(result.success).toHaveLength(1);
    expect(result.success[0].title).toBe("good");
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toBe("bad.docx");
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/fileParser.test.ts
```

Expected: All 5 tests pass (the .docx test with invalid content should go to `failed`).

- [ ] **Step 5: Commit**

```bash
git add packages/web/package.json package-lock.json packages/web/src/utils/fileParser.ts packages/web/src/__tests__/fileParser.test.ts
git commit -m "feat: add fileParser utility for .docx and .md import"
```

---

### Task 2: Create ImportView component

**Files:**
- Create: `packages/web/src/components/ImportView.tsx`

- [ ] **Step 1: Create ImportView.tsx**

Create `packages/web/src/components/ImportView.tsx`:

```tsx
import { useState, useRef } from "react";
import { ArrowLeft, Upload, X, FileText } from "lucide-react";
import { useStore } from "../store";
import { parseFiles, ParseResult } from "../utils/fileParser";

interface Props {
  onBack: () => void;
}

type Phase = "select" | "importing" | "done";

export function ImportView({ onBack }: Props) {
  const { createNote } = useStore();
  const [noteType, setNoteType] = useState("memo");
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("select");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ imported: number; failed: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected) {
      setFiles((prev) => [...prev, ...Array.from(selected)]);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    setPhase("importing");
    setProgress({ current: 0, total: files.length });

    const parsed: ParseResult = await parseFiles(files);

    let imported = 0;
    for (const item of parsed.success) {
      await createNote({ type: noteType, title: item.title, content: item.html });
      imported++;
      setProgress({ current: imported, total: files.length });
    }

    setResult({
      imported,
      failed: parsed.failed.length,
      skipped: parsed.skipped.length,
    });
    setPhase("done");
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="import-view">
      <div className="edit-header">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={18} /></button>
        <h2>导入文档</h2>
        <div />
      </div>
      <div className="import-body">
        {phase === "select" && (
          <>
            <div className="form-row type-row">
              <span className="import-label">导入为：</span>
              <button className={`type-btn ${noteType === "memo" ? "active" : ""}`} onClick={() => setNoteType("memo")}>备忘</button>
              <button className={`type-btn ${noteType === "todo" ? "active" : ""}`} onClick={() => setNoteType("todo")}>待办</button>
            </div>
            <button className="import-pick-btn" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              <span>选择文件</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".docx,.md" multiple style={{ display: "none" }} onChange={handleFileChange} />
            {files.length > 0 && (
              <div className="import-file-list">
                {files.map((file, i) => (
                  <div key={i} className="import-file-item">
                    <FileText size={14} />
                    <span className="import-file-name">{file.name}</span>
                    <span className="import-file-size">{formatSize(file.size)}</span>
                    <button className="icon-btn" onClick={() => removeFile(i)}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            {files.length > 0 && (
              <button className="save-btn" onClick={handleImport}>
                开始导入 ({files.length} 个文件)
              </button>
            )}
          </>
        )}
        {phase === "importing" && (
          <div className="import-progress">
            <p>正在导入 {progress.current}/{progress.total}...</p>
            <div className="upload-progress"><div className="upload-progress-bar" /></div>
          </div>
        )}
        {phase === "done" && result && (
          <div className="import-result">
            <p className="import-result-main">成功导入 {result.imported} 条笔记</p>
            {result.failed > 0 && <p className="import-result-warn">{result.failed} 个文件解析失败</p>}
            {result.skipped > 0 && <p className="import-result-warn">{result.skipped} 个文件格式不支持已跳过</p>}
            <button className="save-btn" onClick={onBack}>完成</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/ImportView.tsx
git commit -m "feat: add ImportView component for document import UI"
```

---

### Task 3: Add CSS for ImportView

**Files:**
- Modify: `packages/web/src/App.css`

- [ ] **Step 1: Add import view styles**

Append to `packages/web/src/App.css`:

```css
/* Import View */
.import-view { display: flex; flex-direction: column; height: 100vh; background: var(--bg); }
.import-body { flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 16px; overflow-y: auto; }
.import-label { font-size: 12px; color: var(--text-muted); }
.import-pick-btn { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border: 1.5px dashed var(--border); background: transparent; color: var(--text-muted); border-radius: var(--radius); cursor: pointer; font-size: 13px; }
.import-pick-btn:hover { border-color: var(--accent); color: var(--text); }
.import-file-list { display: flex; flex-direction: column; gap: 6px; }
.import-file-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface); border-radius: var(--radius); }
.import-file-name { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.import-file-size { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.import-progress { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; }
.import-result { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px; }
.import-result-main { font-size: 16px; font-weight: 600; }
.import-result-warn { font-size: 12px; color: var(--accent); }
.import-link { background: none; border: none; color: var(--accent); font-size: 12px; cursor: pointer; padding: 0; }
.import-link:hover { text-decoration: underline; }
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/App.css
git commit -m "feat: add CSS styles for import view"
```

---

### Task 4: Wire ImportView into App.tsx and add entry points

**Files:**
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/components/SettingsPanel.tsx`
- Modify: `packages/web/src/components/EditView.tsx`

- [ ] **Step 1: Add "import" view state to App.tsx**

In `packages/web/src/App.tsx`:

1. Add import for ImportView:

```tsx
import { ImportView } from "./components/ImportView";
```

2. Change the view type from `"list" | "edit" | "settings"` to `"list" | "edit" | "settings" | "import"`:

```tsx
const [view, setView] = useState<"list" | "edit" | "settings" | "import">("list");
```

3. Add the import view rendering, after the settings check:

```tsx
if (view === "settings") return <SettingsPanel onClose={() => setView("list")} onImport={() => setView("import")} />;
if (view === "import") return <ImportView onBack={() => setView("list")} />;
```

- [ ] **Step 2: Add "导入文档" button to SettingsPanel**

In `packages/web/src/components/SettingsPanel.tsx`:

1. Update the Props interface:

```tsx
interface Props { onClose: () => void; onImport: () => void; }
```

2. Update the destructured props:

```tsx
export function SettingsPanel({ onClose, onImport }: Props) {
```

3. Add the import button at the bottom of the settings-form div, after the form-row:

```tsx
        <h3>数据</h3>
        <button className="import-pick-btn" onClick={onImport}>
          <span>导入文档（.docx / .md）</span>
        </button>
```

- [ ] **Step 3: Add "从文件导入" link to EditView**

In `packages/web/src/components/EditView.tsx`:

1. Update the Props interface:

```tsx
interface Props { noteId: string | null; onBack: () => void; onImport?: () => void; }
```

2. Update the destructured props:

```tsx
export function EditView({ noteId, onBack, onImport }: Props) {
```

3. In the type-row div, add the import link after the shared-toggle label:

```tsx
<span className="spacer" />
{!noteId && onImport && <button className="import-link" onClick={onImport}>从文件导入</button>}
<label className="shared-toggle"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /><span>共享</span></label>
```

4. Update App.tsx to pass `onImport` to EditView:

```tsx
if (view === "edit") return <EditView noteId={editNoteId} onBack={() => { setView("list"); setEditNoteId(null); }} onImport={() => setView("import")} />;
```

- [ ] **Step 4: Verify build passes**

```bash
cd /home/sonzhen/memo-widget/packages/web && npx tsc --noEmit && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/components/SettingsPanel.tsx packages/web/src/components/EditView.tsx
git commit -m "feat: wire ImportView into app with entry points in settings and edit view"
```

---

## Dependency Order

Task 1 must be done first (fileParser is used by ImportView). Tasks 2 and 3 depend on Task 1. Task 4 depends on Task 2 and 3.

Recommended execution order: 1, 2, 3, 4 (sequential).
