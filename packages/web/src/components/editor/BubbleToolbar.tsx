import { useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Editor } from "@tiptap/react";
import { Bold, Italic, Underline, Strikethrough, Palette, Highlighter, Type, Link } from "lucide-react";
import { ColorPicker } from "./ColorPicker";

const FONT_SIZES = [
  { label: "小", value: "12px" },
  { label: "正常", value: "14px" },
  { label: "大", value: "18px" },
  { label: "超大", value: "24px" },
];

interface Props { editor: Editor; }

export function BubbleToolbar({ editor }: Props) {
  const [showColor, setShowColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);

  const setLink = () => {
    const url = window.prompt("链接地址:", "https://");
    if (url) { editor.chain().focus().setLink({ href: url }).run(); }
  };

  return (
    <BubbleMenu editor={editor} className="bubble-toolbar">
      <button className={`tb-btn ${editor.isActive("bold") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></button>
      <button className={`tb-btn ${editor.isActive("italic") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></button>
      <button className={`tb-btn ${editor.isActive("underline") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={14} /></button>
      <button className={`tb-btn ${editor.isActive("strike") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></button>

      <span className="tb-divider" />

      <div className="tb-dropdown-wrap">
        <button className="tb-btn" onClick={() => { setShowColor(!showColor); setShowHighlight(false); setShowFontSize(false); }}><Palette size={14} /></button>
        {showColor && <ColorPicker onSelect={(c) => c ? editor.chain().focus().setColor(c).run() : editor.chain().focus().unsetColor().run()} onClose={() => setShowColor(false)} />}
      </div>

      <div className="tb-dropdown-wrap">
        <button className="tb-btn" onClick={() => { setShowHighlight(!showHighlight); setShowColor(false); setShowFontSize(false); }}><Highlighter size={14} /></button>
        {showHighlight && <ColorPicker onSelect={(c) => c ? editor.chain().focus().toggleHighlight({ color: c }).run() : editor.chain().focus().unsetHighlight().run()} onClose={() => setShowHighlight(false)} />}
      </div>

      <div className="tb-dropdown-wrap">
        <button className="tb-btn" onClick={() => { setShowFontSize(!showFontSize); setShowColor(false); setShowHighlight(false); }}><Type size={14} /></button>
        {showFontSize && (
          <div className="font-size-popup" onClick={(e) => e.stopPropagation()}>
            {FONT_SIZES.map((fs) => (
              <button key={fs.value} className="fs-option" onClick={() => { editor.chain().focus().setFontSize(fs.value).run(); setShowFontSize(false); }}>{fs.label}</button>
            ))}
            <button className="fs-option" onClick={() => { editor.chain().focus().unsetFontSize().run(); setShowFontSize(false); }}>重置</button>
          </div>
        )}
      </div>

      <span className="tb-divider" />

      <button className={`tb-btn ${editor.isActive("link") ? "active" : ""}`} onClick={setLink}><Link size={14} /></button>
    </BubbleMenu>
  );
}
