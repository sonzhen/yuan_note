import { useState } from "react";
import { useStore } from "../store";
import { Plus, Search, X } from "lucide-react";

interface Props { onNewNote: () => void; }

export function Toolbar({ onNewNote }: Props) {
  const { filter, setFilter, searchQuery, setSearchQuery } = useStore();
  const [showSearch, setShowSearch] = useState(false);
  const tabs = [{ label: "All", value: undefined }, { label: "Memo", value: "memo" }, { label: "Todo", value: "todo" }] as const;

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-tabs">
          {tabs.map((tab) => (
            <button key={tab.label} className={`tab-btn ${filter.type === tab.value ? "active" : ""}`} onClick={() => setFilter({ type: tab.value })}>{tab.label}</button>
          ))}
        </div>
      </div>
      <div className="bottom-bar">
        {showSearch ? (
          <div className="search-box-bottom">
            <Search size={14} />
            <input autoFocus placeholder="搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button className="icon-btn" onClick={() => { setShowSearch(false); setSearchQuery(""); }}><X size={14} /></button>
          </div>
        ) : (
          <button className="search-trigger" onClick={() => setShowSearch(true)}>
            <Search size={14} /><span>搜索笔记...</span>
          </button>
        )}
        <button className="fab-btn" onClick={onNewNote} title="新建笔记"><Plus size={24} /></button>
      </div>
    </>
  );
}
