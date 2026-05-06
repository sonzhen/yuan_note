import { useState, useEffect, useCallback } from "react";
import { useStore } from "./store";
import { setConflictHandler } from "./sync";
import { Conflict } from "./sync/merge";
import { PinScreen } from "./components/PinScreen";
import { TitleBar } from "./components/TitleBar";
import { SpaceTabs } from "./components/SpaceTabs";
import { Toolbar } from "./components/Toolbar";
import { NoteList } from "./components/NoteList";
import { EditView } from "./components/EditView";
import { SettingsPanel } from "./components/SettingsPanel";
import { ImportView } from "./components/ImportView";
import { ConflictResolver } from "./components/ConflictResolver";
import "./App.css";

interface ConflictState {
  noteId: string;
  merged: string[];
  conflicts: Conflict[];
  resolve: (choices: ("local" | "remote")[]) => void;
  dismiss: () => void;
}

function App() {
  const { user, restoreSession } = useStore();
  const [view, setView] = useState<"list" | "edit" | "settings" | "import">("list");
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  useEffect(() => {
    if (window.location.search.includes("reset")) {
      indexedDB.deleteDatabase("memo-widget");
      localStorage.clear();
      navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      window.location.href = window.location.pathname;
      return;
    }
    restoreSession();
  }, []);

  useEffect(() => {
    setConflictHandler((noteId, merged, conflicts, resolve, dismiss) => {
      setConflictState({ noteId, merged, conflicts, resolve, dismiss });
    });
    return () => { setConflictHandler(null); };
  }, []);

  const handleConflictResolve = useCallback((choices: ("local" | "remote")[]) => {
    if (conflictState) {
      conflictState.resolve(choices);
      setConflictState(null);
    }
  }, [conflictState]);

  const handleConflictDismiss = useCallback(() => {
    if (conflictState) {
      conflictState.dismiss();
      setConflictState(null);
    }
  }, [conflictState]);

  if (!user) return <PinScreen />;
  if (view === "edit") return <EditView noteId={editNoteId} onBack={() => { setView("list"); setEditNoteId(null); }} onImport={() => setView("import")} />;
  if (view === "settings") return <SettingsPanel onClose={() => setView("list")} onImport={() => setView("import")} />;
  if (view === "import") return <ImportView onBack={() => setView("list")} />;

  return (
    <div className="app-shell">
      <TitleBar onOpenSettings={() => setView("settings")} />
      <SpaceTabs />
      <Toolbar onNewNote={() => { setEditNoteId(null); setView("edit"); }} />
      <NoteList onEdit={(id) => { setEditNoteId(id); setView("edit"); }} />
      {conflictState && (
        <ConflictResolver
          conflicts={conflictState.conflicts}
          mergedBlocks={conflictState.merged}
          onResolve={handleConflictResolve}
          onDismiss={handleConflictDismiss}
        />
      )}
    </div>
  );
}

export default App;
