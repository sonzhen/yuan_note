import { useState, useEffect } from "react";
import { useStore } from "../store";
import { db } from "../db";
import { Note, Tag } from "../types";
import { Save, ArrowLeft, Clock, Tag as TagIcon } from "lucide-react";
import { MilkdownEditor } from "./MilkdownEditor";
import dayjs from "dayjs";

interface Props { noteId: string | null; onBack: () => void; }

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
        if (note) { setTitle(note.title); setContent(note.content); setNoteType(note.type); setShared(Boolean(note.shared)); setDueAt(note.due_at || ""); setSelectedTags(note.tag_ids || []); }
        setReady(true);
      });
    } else { setReady(true); }
  }, [noteId]);

  const save = async () => {
    setSaving(true);
    if (noteId) { await updateNote(noteId, { title, content, type: noteType, shared, due_at: dueAt || null, tag_ids: selectedTags }); }
    else { await createNote({ type: noteType, title, content, shared, due_at: dueAt || undefined, tag_ids: selectedTags }); }
    setSaving(false);
    onBack();
  };

  const toggleTag = (tagId: string) => { setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]); };

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
          <label className="shared-toggle"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /><span>共享</span></label>
        </div>
        <input className="edit-title" placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        {ready && <MilkdownEditor defaultValue={content} onChange={(md) => setContent(md)} />}
        <div className="form-row">
          <Clock size={14} />
          <input type="datetime-local" value={dueAt ? dayjs(dueAt).format("YYYY-MM-DDTHH:mm") : ""} onChange={(e) => setDueAt(e.target.value ? new Date(e.target.value).toISOString() : "")} />
        </div>
        {tags.length > 0 && (
          <div className="form-row tags-row">
            <TagIcon size={14} />
            <div className="tag-choices">
              {tags.map((tag: Tag) => (
                <button key={tag.id} className={`tag-chip ${selectedTags.includes(tag.id) ? "selected" : ""}`} style={{ borderColor: tag.color, backgroundColor: selectedTags.includes(tag.id) ? tag.color : "transparent" }} onClick={() => toggleTag(tag.id)}>{tag.name}</button>
              ))}
            </div>
          </div>
        )}
        <button className="save-btn" onClick={save} disabled={!title.trim() || saving}><Save size={14} />{saving ? "保存中..." : "保存"}</button>
      </div>
    </div>
  );
}
