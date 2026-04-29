import { useState } from "react";
import { useStore } from "../store";
import { Plus, Search, X } from "lucide-react";

interface Props { onNewNote: () => void; }

export function Toolbar({ onNewNote }: Props) {
  const { filter, setFilter, searchQuery, setSearchQuery } = useStore();
  const [showSearch, setShowSearch] = useState(false);
  const tabs = [{ label: "All", value: undefined }, { label: "Memo", value: "memo" }, { label: "Todo", value: "todo" }] as const;

  return (
    <div className="toolbar">
      <div className="toolbar-tabs">
        {tabs.map((tab) => (
          <button key={tab.label} className={`tab-btn ${filter.type === tab.value ? "active" : ""}`} onClick={() => setFilter({ type: tab.value })}>{tab.label}</button>
        ))}
      </div>
      <div className="toolbar-actions">
        {showSearch ? (
          <div className="search-box">
            <input autoFocus placeholder="搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button className="icon-btn" onClick={() => { setShowSearch(false); setSearchQuery(""); }}><X size={14} /></button>
          </div>
        ) : (
          <button className="icon-btn" onClick={() => setShowSearch(true)} title="搜索"><Search size={16} /></button>
        )}
        <button className="icon-btn add-btn" onClick={onNewNote} title="新建笔记"><Plus size={18} /></button>
      </div>
    </div>
  );
}
