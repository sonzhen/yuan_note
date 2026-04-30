
const COLORS = [
  "#ffffff", "#cccccc", "#999999", "#666666", "#333333", "#000000",
  "#e94560", "#ff6b6b", "#ff9800", "#ffc107", "#4caf50", "#00bcd4",
  "#2196f3", "#3f51b5", "#9c27b0", "#e91e63", "#795548", "#607d8b",
];

interface Props {
  onSelect: (color: string) => void;
  onClose: () => void;
}

export function ColorPicker({ onSelect, onClose }: Props) {
  return (
    <div className="color-picker-popup" onClick={(e) => e.stopPropagation()}>
      <div className="color-grid">
        {COLORS.map((color) => (
          <button
            key={color}
            className="color-swatch"
            style={{ backgroundColor: color }}
            onClick={() => { onSelect(color); onClose(); }}
          />
        ))}
      </div>
      <button className="color-reset" onClick={() => { onSelect(""); onClose(); }}>重置</button>
    </div>
  );
}
