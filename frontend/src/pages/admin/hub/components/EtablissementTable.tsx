import React from "react";

export interface Etablissement {
  id: string;
  name: string;
  type: string;
  plan: string;
  users: number;
  lastLogin: string;
  status: "pending" | "rejected" | "approved" | "active";
}

const PLAN_STYLES: Record<string, React.CSSProperties> = {
  Premium: {
    background: "#052e16",
    color: "#86efac",
    border: "1px solid #166534",
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    padding: "2px 10px",
    borderRadius: 8,
    fontWeight: 700,
    display: "inline-block",
  },
  Standard: {
    background: "#271900",
    color: "#fcd34d",
    border: "1px solid #451a03",
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    padding: "2px 10px",
    borderRadius: 8,
    fontWeight: 700,
    display: "inline-block",
  },
  "Non éligible": {
    background: "#1a0505",
    color: "#fca5a5",
    border: "1px solid #7f1d1d",
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    padding: "2px 10px",
    borderRadius: 8,
    fontWeight: 700,
    display: "inline-block",
  },
};

const TYPE_STYLE: React.CSSProperties = {
  background: "#0f1e38",
  color: "#7dd3fc",
  border: "1px solid #1e3a6e",
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  padding: "2px 10px",
  borderRadius: 8,
  fontWeight: 700,
  display: "inline-block",
};

const ROW_BORDER = "1px solid #0f1825";

const EtablissementTable: React.FC<{
  etablissements: Etablissement[];
  status: "pending" | "rejected" | "approved" | "active";
  search: string;
  onAction: (id: string, action: string) => void;
}> = ({ etablissements, status, search, onAction }) => {
  const filtered = etablissements.filter(e => {
    if (e.status !== status) return false;
    if (!search) return true;
    return e.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ background: "#101828", border: "1px solid #1a2840", borderRadius: 12, marginTop: 10 }}>
      {/* Barre au-dessus du tableau */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: ROW_BORDER }}>
        <div style={{ fontSize: 12, color: "#4b6070" }}>
          Vue filtrée — Filtre :
          <span style={{
            background: status === "pending" ? "#f97316" : status === "rejected" ? "#ef4444" : status === "approved" ? "#2563eb" : "#16a34a",
            color: "#fff",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 11,
            padding: "2px 10px",
            marginLeft: 8,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontFamily: "'DM Sans', Arial, sans-serif",
          }}>{status}</span>
        </div>
        <div style={{ color: "#2d3f55", fontSize: 12 }}>{filtered.length} résultat(s)</div>
      </div>
      {/* En-têtes */}
      <div style={{ display: "grid", gridTemplateColumns: "28% 14% 11% 10% 17% 20%", background: "#0d1225", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#4b6070", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <div style={{ padding: "13px 20px" }}>Établissement</div>
        <div style={{ padding: "13px 20px" }}>Type</div>
        <div style={{ padding: "13px 20px" }}>Plan</div>
        <div style={{ padding: "13px 20px", textAlign: "center" }}>Utilisateurs</div>
        <div style={{ padding: "13px 20px" }}>Dernière connexion</div>
        <div style={{ padding: "13px 20px", textAlign: "center" }}>Actions</div>
      </div>
      {/* Lignes */}
      {filtered.map((e, idx) => (
        <div key={e.id} style={{ display: "grid", gridTemplateColumns: "28% 14% 11% 10% 17% 20%", alignItems: "center", borderBottom: ROW_BORDER, background: idx % 2 === 1 ? "rgba(255,255,255,.018)" : undefined }}>
          <div style={{ padding: "13px 20px", color: "#f1f5f9", fontWeight: 700, fontSize: 13 }}>{e.name}</div>
          <div style={{ padding: "13px 20px" }}><span style={TYPE_STYLE}>{e.type}</span></div>
          <div style={{ padding: "13px 20px" }}><span style={PLAN_STYLES[e.plan] || PLAN_STYLES["Non éligible"]}>{e.plan}</span></div>
          <div style={{ padding: "13px 20px", color: "#64748b", textAlign: "center" }}>{e.users}</div>
          <div style={{ padding: "13px 20px", color: "#64748b", fontSize: 12 }}>{e.lastLogin}</div>
          <div style={{ padding: "13px 20px", textAlign: "center" }}>
            {/* Actions selon le statut */}
            {status === "pending" && (
              <>
                <button style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 700, marginRight: 8, fontFamily: "'DM Sans', Arial, sans-serif", transition: "filter .15s" }} onClick={() => onAction(e.id, "approve")}>Approuver</button>
                <button style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', Arial, sans-serif", transition: "filter .15s" }} onClick={() => onAction(e.id, "reject")}>Rejeter</button>
              </>
            )}
            {status === "rejected" && (
              <button style={{ background: "#d97706", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', Arial, sans-serif", transition: "filter .15s" }} onClick={() => onAction(e.id, "reexamine")}>Réexaminer</button>
            )}
            {status === "approved" && (
              <button style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', Arial, sans-serif", transition: "filter .15s" }} onClick={() => onAction(e.id, "relance")}>Relancer</button>
            )}
            {status === "active" && (
              <button style={{ background: "#0d7a56", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', Arial, sans-serif", transition: "filter .15s" }} onClick={() => onAction(e.id, "gerer")}>Gérer l'établissement →</button>
            )}
          </div>
        </div>
      ))}
      {/* Pied de tableau */}
      <div style={{ padding: "10px 20px", borderTop: ROW_BORDER, color: "#2d3f55", fontSize: 11 }}>
        Dernier accès : Master Admin, il y a 2 min
      </div>
    </div>
  );
};

export default EtablissementTable;
