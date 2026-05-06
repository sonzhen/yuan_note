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
