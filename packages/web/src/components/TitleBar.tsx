import { Settings, LogOut } from "lucide-react";
import { useStore } from "../store";

interface Props { onOpenSettings: () => void; }

export function TitleBar({ onOpenSettings }: Props) {
  const { user, logout, syncing } = useStore();
  return (
    <div className="title-bar">
      <span className="title-bar-label">YuanNote{syncing && <span className="sync-indicator"> ↻</span>}</span>
      <div className="title-bar-actions">
        <span className="user-name">{user?.name}</span>
        <button className="title-btn" onClick={onOpenSettings} title="设置"><Settings size={14} /></button>
        <button className="title-btn" onClick={logout} title="退出"><LogOut size={14} /></button>
      </div>
    </div>
  );
}
