import { LogOut } from "lucide-react";
import { useMasterAuth } from "@/hooks/useMasterAuth";

interface SuperAdminNavbarProps {
  onInviteClick?: () => void;
}

const SuperAdminNavbar: React.FC<SuperAdminNavbarProps> = ({ onInviteClick }) => {
  const { masterLogout } = useMasterAuth();

  const handleLogout = async () => {
    await masterLogout();
  };

  return (
    <div
      style={{
        height: 64,
        background: "#0d1225",
        borderBottom: "1px solid #1a2840",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(24px,5vw,80px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 48 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
          </svg>
          <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 22, letterSpacing: "-0.5px" }}>
            EduNexus
          </span>
        </a>

        <span style={{ color: "#2d3f55", fontSize: 20, margin: "0 4px" }}>|</span>

        <span style={{
          background: "rgba(124,58,237,0.15)",
          color: "#a78bfa",
          border: "1px solid rgba(124,58,237,0.25)",
          borderRadius: 999,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 600,
        }}>
          Super Admin
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onInviteClick && (
          <button
            onClick={onInviteClick}
            style={{
              background: "#2563eb",
              color: "white",
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            + Inviter une ecole
          </button>
        )}

        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            color: "#f87171",
            border: "1px solid rgba(239,68,68,0.4)",
            fontWeight: 500,
            padding: "8px 16px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.08)";
            e.currentTarget.style.borderColor = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
          }}
        >
          <LogOut size={14} />
          Se deconnecter
        </button>
      </div>
    </div>
  );
};

export default SuperAdminNavbar;