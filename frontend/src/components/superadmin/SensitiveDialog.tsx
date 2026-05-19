import React, { useState } from "react";

interface SensitiveDialogProps {
  title: string;
  onConfirm: (password: string, code: string) => void;
  onCancel: () => void;
  loading: boolean;
}

const SensitiveDialog: React.FC<SensitiveDialogProps> = ({ title, onConfirm, onCancel, loading }) => {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#081226", border: "1px solid #223047",
    borderRadius: 8, padding: "10px 14px", color: "#f1f5f9",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ width: 480, background: "#0b1220", borderRadius: 12, padding: 24, border: "1px solid #223047" }}>
        <h3 style={{ color: "#f8fafc", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{title}</h3>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>Saisis ton mot de passe master et ton code MFA pour confirmer.</p>
        <div style={{ display: "grid", gap: 10 }}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe master" style={inputStyle} />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code MFA (6 chiffres) ou recovery code" style={{ ...inputStyle, letterSpacing: 4 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={onCancel} style={{ background: "transparent", border: "1px solid #223047", color: "#94a3b8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
              Annuler
            </button>
            <button
              onClick={() => onConfirm(password, code)}
              disabled={loading || !password || !code}
              style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: (!password || !code) ? 0.5 : 1 }}
            >
              {loading ? "..." : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SensitiveDialog;