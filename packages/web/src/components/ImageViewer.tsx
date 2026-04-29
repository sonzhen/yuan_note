import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface Props {
  src: string;
  onClose: () => void;
}

export function ImageViewer({ src, onClose }: Props) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(5, s + 0.25));
      if (e.key === "-") setScale((s) => Math.max(0.3, s - 0.25));
      if (e.key === "0") setScale(1);
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.3, Math.min(5, s - e.deltaY * 0.002)));
  };

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <button className="image-viewer-close" onClick={onClose}><X size={20} /></button>
      <div className="image-viewer-controls" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setScale((s) => Math.max(0.3, s - 0.25))}><ZoomOut size={16} /></button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(5, s + 0.25))}><ZoomIn size={16} /></button>
        <button onClick={() => setScale(1)}><RotateCcw size={14} /></button>
      </div>
      <img
        src={src}
        className="image-viewer-img"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        draggable={false}
      />
    </div>
  );
}
