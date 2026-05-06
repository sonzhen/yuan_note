import { Note } from "../types";
import { useStore } from "../store";
import { Check, Circle, Trash2, Clock, Edit3, GripVertical, CheckSquare, StickyNote } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import dayjs from "dayjs";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return dayjs(iso).format("MM-DD HH:mm");
}

interface Props { note: Note; onEdit: (id: string) => void; }

export function NoteItem({ note, onEdit }: Props) {
  const { toggleDone, deleteNote } = useStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`note-item ${note.is_done ? "done" : ""}`}>
      <button className="drag-handle" {...attributes} {...listeners}><GripVertical size={14} /></button>
      <button className="note-check" onClick={() => toggleDone(note.id, !note.is_done)}>
        {note.is_done ? <Check size={14} /> : <Circle size={14} />}
      </button>
      <div className="note-body" onClick={() => onEdit(note.id)}>
        <div className="note-title-row">
          <span className={`note-type-badge ${note.type}`}>
            {note.type === "todo" ? <CheckSquare size={10} /> : <StickyNote size={10} />}
          </span>
          <span className="note-title">{note.title}</span>
        </div>
        <div className="note-meta">
          {note.due_at && <span className="note-due"><Clock size={10} />{dayjs(note.due_at).format("MM/DD HH:mm")}</span>}
          <span className="note-updated">{relativeTime(note.updated_at)}</span>
        </div>
      </div>
      <div className="note-actions">
        <button className="icon-btn" onClick={() => onEdit(note.id)} title="编辑"><Edit3 size={13} /></button>
        <button className="icon-btn danger" onClick={() => deleteNote(note.id)} title="删除"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}
