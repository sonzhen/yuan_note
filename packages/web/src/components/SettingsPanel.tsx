import { useState } from "react";
import { useStore } from "../store";
import { X } from "lucide-react";

interface Props { onClose: () => void; onImport: () => void; }

export function SettingsPanel({ onClose, onImport }: Props) {
  const { tags, createTag, deleteTag } = useStore();
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#e94560");

  const handleCreateTag = async () => { if (!newTagName.trim()) return; await createTag(newTagName, newTagColor); setNewTagName(""); };

  return (
    <div className="settings-panel">
      <div className="settings-header"><h2>设置</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
      <div className="settings-form">
        <h3>标签管理</h3>
        <div className="tag-list">
          {tags.map((tag) => (<div key={tag.id} className="tag-row"><span className="tag-chip selected" style={{ backgroundColor: tag.color }}>{tag.name}</span><button className="icon-btn danger" onClick={() => deleteTag(tag.id)}>×</button></div>))}
        </div>
        <div className="form-row">
          <input placeholder="标签名" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
          <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
          <button className="type-btn active" onClick={handleCreateTag}>添加</button>
        </div>
        <h3>数据</h3>
        <button className="import-pick-btn" onClick={onImport}>
          <span>导入文档（.docx / .md）</span>
        </button>
      </div>
    </div>
  );
}
