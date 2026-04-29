import { useEditor, Milkdown, MilkdownProvider } from "@milkdown/react";
import { commonmark } from "@milkdown/preset-commonmark";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { nord } from "@milkdown/theme-nord";

interface Props { defaultValue: string; onChange: (markdown: string) => void; }

function EditorInner({ defaultValue, onChange }: Props) {
  useEditor((container) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, defaultValue);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => { onChange(markdown); });
      })
      .config(nord)
      .use(commonmark)
      .use(listener);
  }, [defaultValue]);
  return <Milkdown />;
}

export function MilkdownEditor(props: Props) {
  return (
    <MilkdownProvider>
      <div className="milkdown-wrapper"><EditorInner {...props} /></div>
    </MilkdownProvider>
  );
}
