import { useStore } from "../store";

export function SpaceTabs() {
  const { space, setSpace } = useStore();
  return (
    <div className="space-tabs">
      <button className={`space-tab ${space === "mine" ? "active" : ""}`} onClick={() => setSpace("mine")}>我的</button>
      <button className={`space-tab ${space === "shared" ? "active" : ""}`} onClick={() => setSpace("shared")}>共享</button>
    </div>
  );
}
