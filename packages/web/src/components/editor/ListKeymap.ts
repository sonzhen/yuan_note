import { Extension } from "@tiptap/core";

export const ListKeymap = Extension.create({
  name: "listKeymap",
  priority: 101,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;

        if (!selection.empty) return false;

        const listItem = editor.isActive("listItem") || editor.isActive("taskItem");
        if (!listItem) return false;

        const isAtStart = $from.parentOffset === 0;
        if (!isAtStart) return false;

        const depth = $from.depth;
        let listDepth = 0;
        for (let d = depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === "bulletList" || node.type.name === "orderedList" || node.type.name === "taskList") {
            listDepth++;
          }
        }

        if (listDepth > 1) {
          return editor.commands.liftListItem("listItem") || editor.commands.liftListItem("taskItem");
        }

        if (editor.isActive("taskItem")) {
          return editor.chain().liftListItem("taskItem").lift("taskList").run();
        }
        return editor.chain().liftListItem("listItem").lift("bulletList").lift("orderedList").run();
      },
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;

        if (!selection.empty) return false;

        const parent = $from.parent;
        const isEmpty = parent.content.size === 0;
        if (!isEmpty) return false;

        if (editor.isActive("listItem")) {
          return editor.chain().liftListItem("listItem").lift("bulletList").lift("orderedList").run();
        }
        if (editor.isActive("taskItem")) {
          return editor.chain().liftListItem("taskItem").lift("taskList").run();
        }
        if (editor.isActive("blockquote")) {
          return editor.commands.lift("blockquote");
        }
        if (editor.isActive("heading")) {
          return editor.chain().splitBlock().setNode("paragraph").run();
        }

        return false;
      },
    };
  },
});
