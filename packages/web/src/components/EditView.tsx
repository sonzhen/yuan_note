import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "../store";
import { db } from "../db";
import { Note, Tag } from "../types";
import { Save, ArrowLeft, Clock } from "lucide-react";
import { TiptapEditor, TiptapEditorHandle } from "./editor/TiptapEditor";
import { ImageViewer } from "./ImageViewer";
import { migrateContent } from "./editor/migrate";
import dayjs from "dayjs";

interface Props { noteId: string | null; onBack: () => void; }

export function EditView({ noteId, onBack }: Props) {
  const { createNote, updateNote, tags, space } = useStore();
  const [title, setTitle] = useState("");
  const contentRef = useRef("");
  const [noteType, setNoteType] = useState("memo");
  const [shared, setShared] = useState(space === "shared");
  const [dueAt, setDueAt] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [initialContent, setInitialContent] = useState("");
  const [saved, setSaved] = useState(true);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TiptapEditorHandle>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef("");
  const savedNoteId = useRef<string | null>(noteId);

  useEffect(() => {
    if (noteId) {
      db.notes.get(noteId).then((note: Note | undefined) => {
        if (note) {
          setTitle(note.title);
          titleRef.current = note.title;
          const html = migrateContent(note.content);
          contentRef.current = html;
          setInitialContent(html);
          setNoteType(note.type);
          setShared(Boolean(note.shared));
          setDueAt(note.due_at || "");
          setSelectedTags(note.tag_ids || []);
        }
        setReady(true);
      });
    } else {
      setDueAt(new Date().toISOString());
      setReady(true);
    }
  }, [noteId]);

  const save = useCallback(async () => {
    const currentTitle = titleRef.current;
    if (!currentTitle.trim()) return;
    setSaving(true);
    const content = contentRef.current;
    if (savedNoteId.current) {
      await updateNote(savedNoteId.current, { title: currentTitle, content, type: noteType, shared, due_at: dueAt || null, tag_ids: selectedTags });
    } else {
      const newId = await createNote({ type: noteType, title: currentTitle, content, shared, due_at: dueAt || undefined, tag_ids: selectedTags });
      if (newId) savedNoteId.current = newId;
    }
    setSaving(false);
    setSaved(true);
  }, [noteType, shared, dueAt, selectedTags, updateNote, createNote]);

  const scheduleAutoSave = useCallback(() => {
    setSaved(false);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { save(); }, 3000);
  }, [save]);

  const handleContentChange = useCallback((html: string) => {
    contentRef.current = html;
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    titleRef.current = e.target.value;
    scheduleAutoSave();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewImage) { setViewImage(null); }
        else { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); save().then(onBack); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [viewImage, save, onBack]);

  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const toggleTag = (tagId: string) => { setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]); };

  const handleImagePick = () => { fileInputRef.current?.click(); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (editorRef.current) {
        editorRef.current.insertImage(dataUrl, file.name);
      }
      setUploading(false);
    };
    reader.onerror = () => { setUploading(false); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const src = (target as HTMLImageElement).src;
      if (src) { e.preventDefault(); setViewImage(src); }
    }
  }, []);

  const handleBack = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    save().then(onBack);
  };

  return (
    <div className="edit-view">
      <div className="edit-header">
        <button className="icon-btn" onClick={handleBack}><ArrowLeft size={18} /></button>
        <h2>{noteId ? "编辑笔记" : "新建笔记"}</h2>
        <div className="edit-header-right">
          {!saved && <span className="autosave-hint">未保存</span>}
          {saving && <span className="autosave-hint">保存中...</span>}
          {saved && !saving && <span className="autosave-hint saved">已保存</span>}
        </div>
      </div>
      {uploading && <div className="upload-progress"><div className="upload-progress-bar" /></div>}
      <div className="edit-body">
        <div className="edit-scrollable" onClick={handleEditorClick}>
          <div className="form-row type-row">
            <button className={`type-btn ${noteType === "memo" ? "active" : ""}`} onClick={() => setNoteType("memo")}>备忘</button>
            <button className={`type-btn ${noteType === "todo" ? "active" : ""}`} onClick={() => setNoteType("todo")}>待办</button>
            <span className="spacer" />
            <label className="shared-toggle"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /><span>共享</span></label>
          </div>
          <input className="edit-title" placeholder="标题" value={title} onChange={handleTitleChange} />
          {ready && (
            <TiptapEditor
              ref={editorRef}
              defaultValue={initialContent}
              onChange={handleContentChange}
              onImagePick={handleImagePick}
            />
          )}
        </div>
        <div className="edit-footer">
          {tags.length > 0 && (
            <div className="footer-tags">
              {tags.map((tag: Tag) => (
                <button key={tag.id} className={`tag-chip ${selectedTags.includes(tag.id) ? "selected" : ""}`} style={{ borderColor: tag.color, backgroundColor: selectedTags.includes(tag.id) ? tag.color : "transparent" }} onClick={() => toggleTag(tag.id)}>{tag.name}</button>
              ))}
            </div>
          )}
          <div className="footer-row">
            <div className="footer-date" onClick={() => dateInputRef.current?.showPicker()}>
              <Clock size={14} />
              <span>{dueAt ? dayjs(dueAt).format("MM-DD HH:mm") : "提醒时间"}</span>
              <input ref={dateInputRef} type="datetime-local" className="date-input-hidden" value={dueAt ? dayjs(dueAt).format("YYYY-MM-DDTHH:mm") : ""} onChange={(e) => setDueAt(e.target.value ? new Date(e.target.value).toISOString() : "")} />
            </div>
            <button className="save-btn" onClick={() => save()} disabled={!title.trim() || saving}><Save size={14} />{saving ? "保存中" : "保存"}</button>
          </div>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
      {viewImage && <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />}
    </div>
  );
}
