import { Navigate } from "react-router";
import { useAuth } from "@/hooks/AuthProvider";
import { getRoleHomePath } from "@/lib/roleAccess";
import UniversalUserForm from "@/components/auth/UniversalUserForm";

const Login = () => {
  const { user, loading } = useAuth();

  if (user && !loading) {
    return <Navigate to={getRoleHomePath(user.role)} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#080c18" }}>
      <style>{`
        @media (max-width: 860px) { .login-image-col { display: none !important; } }
      `}</style>

      {/* ─── Colonne gauche — image ─── */}
      <div className="login-image-col" style={{
        flex: "0 0 55%", position: "relative", overflow: "hidden",
      }}>
        {/* Image */}
        <img
          src="https://images.unsplash.com/photo-1610962381137-50ef93055125?auto=format&fit=crop&w=1400&q=80"
          alt="École"
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.4)" }}
        />
        {/* Overlay gradient */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, rgba(8,12,24,0.7) 0%, rgba(37,99,235,0.15) 100%)",
        }} />
        {/* Contenu sur l'image */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "clamp(36px,5vw,60px)",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="32" height="32" viewBox="0 0 48 46" fill="none">
              <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
            </svg>
            <span style={{ color: "white", fontWeight: 700, fontSize: 22, letterSpacing: "-0.5px" }}>EduNexus</span>
          </div>

          {/* Texte bas */}
          <div>
            <h1 style={{ fontSize: "clamp(28px,3.5vw,48px)", fontWeight: 900, color: "white", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 16 }}>
              La plateforme scolaire du Cameroun
            </h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, maxWidth: 440 }}>
              Gestion académique, notes, bulletins et présences — tout en un seul endroit.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              {["Bulletins PDF", "Emploi du temps", "Notes en ligne", "Présences"].map((tag) => (
                <span key={tag} style={{
                  background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999,
                  padding: "5px 14px", fontSize: 12, fontWeight: 600,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Colonne droite — formulaire ─── */}
      <div className="dark" style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        padding: "clamp(32px,5vw,64px) clamp(24px,4vw,56px)",
        background: "#080c18",
      }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          {/* Logo mobile */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36 }}>
            <svg width="26" height="26" viewBox="0 0 48 46" fill="none">
              <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
            </svg>
            <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 20, letterSpacing: "-0.5px" }}>EduNexus</span>
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 800, color: "white", letterSpacing: "-0.03em", marginBottom: 6 }}>
            Connexion
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Accédez à votre espace école, enseignant, parent ou élève.
          </p>

          {/* Formulaire existant — on garde UniversalUserForm */}
          <UniversalUserForm type="login" />

          <p style={{ color: "#334155", fontSize: 12, marginTop: 32, textAlign: "center" }}>
            © 2025 EduNexus · Plateforme scolaire camerounaise
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

