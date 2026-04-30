import { Editor } from "@tiptap/react";
import {
  Table, Image, Code2, Minus, Quote, List, ListOrdered,
  CheckSquare, IndentIncrease, IndentDecrease, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";
import { useState } from "react";

interface Props {
  editor: Editor;
  onImagePick: () => void;
}

export function EditorToolbar({ editor, onImagePick }: Props) {
  const [showAlign, setShowAlign] = useState(false);

  return (
    <div className="editor-toolbar">
      <button className="tb-btn" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="表格"><Table size={14} /></button>
      <button className="tb-btn" onClick={onImagePick} title="图片"><Image size={14} /></button>
      <button className="tb-btn" onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="代码块"><Code2 size={14} /></button>
      <button className="tb-btn" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线"><Minus size={14} /></button>
      <button className="tb-btn" onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用"><Quote size={14} /></button>

      <span className="tb-divider" />

      <button className="tb-btn" onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表"><List size={14} /></button>
      <button className="tb-btn" onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表"><ListOrdered size={14} /></button>
      <button className="tb-btn" onClick={() => editor.chain().focus().toggleTaskList().run()} title="待办"><CheckSquare size={14} /></button>

      <span className="tb-divider" />

      <button className="tb-btn" onClick={() => editor.chain().focus().indent().run()} title="增加缩进"><IndentIncrease size={14} /></button>
      <button className="tb-btn" onClick={() => editor.chain().focus().outdent().run()} title="减少缩进"><IndentDecrease size={14} /></button>

      <div className="tb-dropdown-wrap">
        <button className="tb-btn" onClick={() => setShowAlign(!showAlign)} title="对齐"><AlignLeft size={14} /></button>
        {showAlign && (
          <div className="align-popup" onClick={(e) => e.stopPropagation()}>
            <button className="tb-btn" onClick={() => { editor.chain().focus().setTextAlign("left").run(); setShowAlign(false); }}><AlignLeft size={14} /></button>
            <button className="tb-btn" onClick={() => { editor.chain().focus().setTextAlign("center").run(); setShowAlign(false); }}><AlignCenter size={14} /></button>
            <button className="tb-btn" onClick={() => { editor.chain().focus().setTextAlign("right").run(); setShowAlign(false); }}><AlignRight size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
