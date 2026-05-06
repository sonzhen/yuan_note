import { Editor } from "@tiptap/react";
import {
  Table, Image, Code2, Minus, Quote, List, ListOrdered,
  CheckSquare, IndentIncrease, IndentDecrease, AlignLeft, AlignCenter, AlignRight,
  AArrowUp, AArrowDown,
} from "lucide-react";
import { useState } from "react";

interface Props {
  editor: Editor;
  onImagePick: () => void;
}

export function EditorToolbar({ editor, onImagePick }: Props) {
  const [showAlign, setShowAlign] = useState(false);

  const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

  const cycleFontSize = (direction: "up" | "down") => {
    const current = editor.getAttributes("textStyle").fontSize || "16px";
    const idx = FONT_SIZES.indexOf(current);
    let next: number;
    if (direction === "up") {
      next = idx < FONT_SIZES.length - 1 ? idx + 1 : idx;
    } else {
      next = idx > 0 ? idx - 1 : idx;
    }
    editor.chain().focus().setFontSize(FONT_SIZES[next]).run();
  };

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

      <span className="tb-divider" />
      <button className="tb-btn" onClick={() => cycleFontSize("up")} title="增大字号"><AArrowUp size={14} /></button>
      <button className="tb-btn" onClick={() => cycleFontSize("down")} title="减小字号"><AArrowDown size={14} /></button>
    </div>
  );
}
