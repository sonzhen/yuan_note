import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { FontSize } from "./FontSize";
import { Indent } from "./Indent";
import { ListKeymap } from "./ListKeymap";
import { EditorToolbar } from "./EditorToolbar";
import { BubbleToolbar } from "./BubbleToolbar";
import { forwardRef, useImperativeHandle, useRef } from "react";

export interface TiptapEditorHandle {
  insertImage: (src: string, alt: string) => void;
  getHTML: () => string;
  focus: () => void;
}

interface Props {
  defaultValue: string;
  onChange: (html: string) => void;
  onImagePick: () => void;
}

export const TiptapEditor = forwardRef<TiptapEditorHandle, Props>(({ defaultValue, onChange, onImagePick }, ref) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TiptapImage.configure({ inline: true }),
      TiptapLink.configure({ openOnClick: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "开始输入..." }),
      FontSize,
      Indent,
      ListKeymap,
    ],
    content: defaultValue,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
    },
  });

  useImperativeHandle(ref, () => ({
    insertImage: (src: string, alt: string) => {
      if (editor) {
        editor.chain().focus().setImage({ src, alt }).run();
      }
    },
    getHTML: () => {
      return editor?.getHTML() || "";
    },
    focus: () => {
      editor?.commands.focus();
    },
  }));

  if (!editor) return null;

  return (
    <div className="tiptap-editor">
      <EditorToolbar editor={editor} onImagePick={onImagePick} />
      <BubbleToolbar editor={editor} />
      <div className="tiptap-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
