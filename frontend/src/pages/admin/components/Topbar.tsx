import React from "react";

const Topbar: React.FC<{ onInviteClick?: () => void }> = ({ onInviteClick }) => {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 56,
        background: "var(--bg2)",
        borderBottom: "1px solid var(--border)",
        padding: "0 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--blue)",
            boxShadow: "0 0 0 3px #2563eb55, 0 0 12px #2563eb55",
            marginRight: 10,
          }}
        />
        <span
          style={{
            color: "var(--blue-l)",
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontFamily: "'DM Sans', Arial, sans-serif",
          }}
        >
          EDUNE — SUPER ADMIN
        </span>
      </div>
      <button
        type="button"
        style={{
          background: "var(--blue)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          padding: "9px 22px",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: "'DM Sans', Arial, sans-serif",
          boxShadow: "0 2px 8px #2563eb22",
          transition: "filter .15s",
        }}
        onClick={onInviteClick}
      >
        ✉ Inviter une école
      </button>
    </header>
  );
};

export default Topbar;
