import React, { useState } from "react";
import { LogOut, Shield, School } from "lucide-react";
import { useMasterAuth } from "@/hooks/useMasterAuth";
import { useNavigate, useLocation } from "react-router";

interface SuperAdminNavbarProps {
  onInviteClick?: () => void;
}

const SuperAdminNavbar: React.FC<SuperAdminNavbarProps> = ({ onInviteClick }) => {
  const { masterLogout } = useMasterAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await masterLogout();
  };

  const navItems = [
    { label: "Hub de Contrôle", path: "/superadmin", icon: <School size={14} /> },
    { label: "Sécurité", path: "/superadmin/security", icon: <Shield size={14} /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{
      height: 64, background: "#0d1225", borderBottom: "1px solid #1a2840",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 clamp(24px,5vw,80px)", position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <a href="/superadmin" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 48 46" fill="none">
            <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
          </svg>
          <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 22, letterSpacing: "-0.5px" }}>EduNexus</span>
        </a>
        <span style={{ color: "#2d3f55", fontSize: 20 }}>|</span>
        <span style={{
          background: "rgba(124,58,237,0.15)", color: "#a78bfa",
          border: "1px solid rgba(124,58,237,0.25)", borderRadius: 999,
          padding: "4px 12px", fontSize: 12, fontWeight: 600,
        }}>Super Admin</span>
        <nav style={{ display: "flex", gap: 4 }}>
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: isActive(item.path) ? "rgba(59,130,246,0.12)" : "transparent",
                color: isActive(item.path) ? "#60a5fa" : "#64748b",
                border: isActive(item.path) ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600,
                cursor: "pointer", transition: "all .15s",
              }}
              onMouseEnter={(e) => { if (!isActive(item.path)) { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}}
              onMouseLeave={(e) => { if (!isActive(item.path)) { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "transparent"; }}}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onInviteClick && (
          <button onClick={onInviteClick} style={{ background: "#2563eb", color: "white", fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13 }}>
            + Inviter une école
          </button>
        )}
        <button
          onClick={handleLogout}
          style={{ background: "transparent", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", fontWeight: 500, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, transition: "all .2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <LogOut size={14} />Se déconnecter
        </button>
      </div>
    </div>
  );
};

export default SuperAdminNavbar;