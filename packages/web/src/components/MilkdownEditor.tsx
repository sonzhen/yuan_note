import { useEditor, Milkdown, MilkdownProvider } from "@milkdown/react";
import { commonmark } from "@milkdown/preset-commonmark";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from "@milkdown/core";
import { nord } from "@milkdown/theme-nord";
import { useImperativeHandle, forwardRef, useRef } from "react";

export interface MilkdownEditorHandle {
  insertImage: (url: string, alt: string) => void;
}

interface Props { defaultValue: string; onChange: (markdown: string) => void; }

const EditorInner = forwardRef<MilkdownEditorHandle, Props>(({ defaultValue, onChange }, ref) => {
  const initialValue = useRef(defaultValue);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { get } = useEditor((container) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, initialValue.current);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChangeRef.current(markdown);
        });
      })
      .config(nord)
      .use(commonmark)
      .use(listener);
  }, []);

  useImperativeHandle(ref, () => ({
    insertImage: (url: string, alt: string) => {
      const editor = get();
      if (!editor) return;
      try {
        const view = editor.ctx.get(editorViewCtx);
        const { state } = view;
        const imageNode = state.schema.nodes.image.create({ src: url, alt });
        const paragraph = state.schema.nodes.paragraph.create(null, imageNode);
        const tr = state.tr.replaceSelectionWith(paragraph);
        view.dispatch(tr);
        setTimeout(() => view.focus(), 0);
      } catch (e) {
        console.error("Insert image failed:", e);
      }
    }
  }));

  return <Milkdown />;
});

export const MilkdownEditor = forwardRef<MilkdownEditorHandle, Props>((props, ref) => {
  return (
    <MilkdownProvider>
      <div className="milkdown-wrapper"><EditorInner ref={ref} {...props} /></div>
    </MilkdownProvider>
  );
});
