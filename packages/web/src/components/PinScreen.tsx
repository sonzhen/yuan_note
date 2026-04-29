import { useState, useEffect } from "react";
import { useStore } from "../store";
import { api } from "../api/client";

export function PinScreen() {
  const { login, setup } = useStore();
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "setup" | "loading">("loading");

  useEffect(() => {
    api.get<{ user_count: number }>("/api/auth/status").then((res) => {
      setMode(res.user_count < 2 ? "setup" : "login");
    }).catch(() => setMode("login"));
  }, []);

  const handleLogin = async () => {
    setError("");
    try { await login(pin); } catch (e) { setError((e as Error).message); }
  };

  const handleSetup = async () => {
    setError("");
    if (!name.trim() || pin.length < 4) { setError("请输入名字和至少4位PIN码"); return; }
    try { await setup(name, pin); setPin(""); setName(""); setMode("login"); } catch (e) { setError((e as Error).message); }
  };

  if (mode === "loading") return <div className="pin-screen"><div className="pin-card">加载中...</div></div>;

  return (
    <div className="pin-screen">
      <div className="pin-card">
        <h1>YuanNote</h1>
        {mode === "setup" ? (
          <>
            <p className="pin-hint">首次使用，请创建用户</p>
            <input className="pin-input" placeholder="你的名字" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="pin-input" type="password" placeholder="设置 PIN 码 (4位以上)" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={8} />
            <button className="pin-btn" onClick={handleSetup}>创建</button>
            <button className="pin-link" onClick={() => setMode("login")}>已有账号？登录</button>
          </>
        ) : (
          <>
            <p className="pin-hint">输入 PIN 码登录</p>
            <input className="pin-input" type="password" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} maxLength={8} autoFocus />
            <button className="pin-btn" onClick={handleLogin}>进入</button>
            <button className="pin-link" onClick={() => setMode("setup")}>新用户注册</button>
          </>
        )}
        {error && <p className="pin-error">{error}</p>}
      </div>
    </div>
  );
}
