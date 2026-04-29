import { useEffect } from "react";
import { useStore } from "../store";
import { NoteItem } from "./NoteItem";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

interface Props { onEdit: (id: string) => void; }

export function NoteList({ onEdit }: Props) {
  const { notes, loading, loadNotes, loadTags, reorderNotes } = useStore();
  useEffect(() => { loadNotes(); loadTags(); }, []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = notes.findIndex((n) => n.id === active.id);
    const newIndex = notes.findIndex((n) => n.id === over.id);
    const reordered = arrayMove(notes, oldIndex, newIndex);
    reorderNotes(reordered.map((n) => n.id));
  };

  if (loading && notes.length === 0) return <div className="empty-state">加载中...</div>;
  if (notes.length === 0) return <div className="empty-state">暂无笔记，点击 + 创建</div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="note-list">{notes.map((note) => <NoteItem key={note.id} note={note} onEdit={onEdit} />)}</div>
      </SortableContext>
    </DndContext>
  );
}
