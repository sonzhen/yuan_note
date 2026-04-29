import { useState, useEffect } from "react";
import { useStore } from "./store";
import { PinScreen } from "./components/PinScreen";
import { TitleBar } from "./components/TitleBar";
import { SpaceTabs } from "./components/SpaceTabs";
import { Toolbar } from "./components/Toolbar";
import { NoteList } from "./components/NoteList";
import { EditView } from "./components/EditView";
import { SettingsPanel } from "./components/SettingsPanel";
import "./App.css";

function App() {
  const { user, restoreSession, sync } = useStore();
  const [view, setView] = useState<"list" | "edit" | "settings">("list");
  const [editNoteId, setEditNoteId] = useState<string | null>(null);

  useEffect(() => { restoreSession(); }, []);
  useEffect(() => {
    if (user) {
      sync();
      const interval = setInterval(sync, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return <PinScreen />;
  if (view === "edit") return <EditView noteId={editNoteId} onBack={() => { setView("list"); setEditNoteId(null); }} />;
  if (view === "settings") return <SettingsPanel onClose={() => setView("list")} />;

  return (
    <div className="app-shell">
      <TitleBar onOpenSettings={() => setView("settings")} />
      <SpaceTabs />
      <Toolbar onNewNote={() => { setEditNoteId(null); setView("edit"); }} />
      <NoteList onEdit={(id) => { setEditNoteId(id); setView("edit"); }} />
    </div>
  );
}

export default App;
