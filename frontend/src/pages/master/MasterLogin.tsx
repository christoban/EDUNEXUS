import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Eye, EyeOff, Layers3, Lock, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMasterAuth } from "@/hooks/useMasterAuth";

const MasterLogin = () => {
  const navigate = useNavigate();
  const { forceRefreshAuth } = useMasterAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<"credentials" | "email" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await api.get("/master/auth/me");
        await forceRefreshAuth();
        navigate("/superadmin", { replace: true });
      } catch {
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [navigate, forceRefreshAuth]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/master/auth/login", { email, password });
      if (data?.requiresEmailVerification) {
        setStage("email");
        setEmailCode("");
        toast.success("Code envoyé par email. Vérifie ta boîte de réception.");
        return;
      }
      await forceRefreshAuth();
      navigate("/superadmin", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Impossible de se connecter.";
      setError(msg);
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  const verifyEmail = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/master/auth/verify-email-code", { code: emailCode });
      if (data?.requiresMfa) {
        setStage("mfa");
        setMfaCode("");
        toast.success("Saisis le code de ton application Authenticator.");
        return;
      }
      await forceRefreshAuth();
      navigate("/superadmin", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Code email invalide.";
      setError(msg);
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  const verifyMfa = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/master/auth/verify-mfa", { code: mfaCode.trim() });
      await forceRefreshAuth();
      navigate("/superadmin", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Code MFA invalide.";
      setError(msg);
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  // ─── Styles ────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0d1825", border: "1px solid #1e3a6e",
    borderRadius: 8, padding: "12px 14px", color: "#f1f5f9",
    fontSize: 15, outline: "none", boxSizing: "border-box",
    transition: "border-color .15s",
  };

  const btnPrimary: React.CSSProperties = {
    width: "100%", background: "#2563eb", color: "white",
    border: "none", borderRadius: 8, padding: "13px 20px",
    fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    opacity: submitting ? 0.7 : 1, transition: "opacity .15s",
  };

  const btnSecondary: React.CSSProperties = {
    width: "100%", background: "transparent", color: "#64748b",
    border: "1px solid #1a2840", borderRadius: 8, padding: "12px 20px",
    fontSize: 14, fontWeight: 500, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 8,
  };

  const stageLabel = stage === "credentials" ? "Étape 1 / 3 — Identifiants"
    : stage === "email" ? "Étape 2 / 3 — Validation email"
    : "Étape 3 / 3 — Code MFA";

  const stageColor = stage === "credentials" ? "#60a5fa"
    : stage === "email" ? "#fb923c"
    : "#a78bfa";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c18", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080c18", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(24px,4vw,48px)" }}>

      <div style={{ display: "flex", gap: 24, width: "100%", maxWidth: 1080, alignItems: "stretch" }} className="login-grid-wrap">
      {/* ─── Colonne gauche — présentation ─── */}
      <div style={{
        flex: 1, display: "none", flexDirection: "column", justifyContent: "space-between",
        padding: "clamp(36px,4vw,56px)", background: "#0d1225",
        border: "1px solid #1a2840", borderRadius: 18,
      }}
        className="login-left"
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="32" height="32" viewBox="0 0 48 46" fill="none">
            <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
          </svg>
          <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 24, letterSpacing: "-0.5px" }}>EduNexus</span>
          <span style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700, marginLeft: 4 }}>
            MASTER
          </span>
        </div>

        {/* Titre */}
        <div>
          <h1 style={{ fontSize: "clamp(28px,3vw,42px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: 16 }}>
            Console de supervision des établissements
          </h1>
          <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.7, maxWidth: 460, marginBottom: 28 }}>
            Gestion centralisée des demandes d'onboarding, validation des tenants et pilotage de la plateforme EduNexus Cameroun.
          </p>
        </div>

        {/* Fonctionnalités */}
        <div style={{ display: "grid", gap: 12 }}>
          {[
            { icon: <Layers3 size={18} color="#7dd3fc" />, label: "Base centralisée", desc: "Registre maître de tous les établissements" },
            { icon: <ShieldCheck size={18} color="#86efac" />, label: "Validation des demandes", desc: "Workflow pending → approved → active" },
            { icon: <Lock size={18} color="#c084fc" />, label: "Session master séparée", desc: "Isolation totale des sessions école" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 14, background: "#101828", border: "1px solid #1a2840", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0d1825", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>{item.label}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Colonne droite — formulaire ─── */}
      <div style={{
        flex: 1, minWidth: 340,
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "clamp(36px,4vw,56px)",
        background: "#0d1628", border: "1px solid #1a2840", borderRadius: 18,
      }}>

        {/* Header mobile logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 40 }}>
          <svg width="28" height="28" viewBox="0 0 48 46" fill="none">
            <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
          </svg>
          <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 20 }}>EduNexus</span>
        </div>

        {/* Badge étape */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${stageColor}18`, border: `1px solid ${stageColor}44`, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: stageColor, marginBottom: 20, width: "fit-content" }}>
          <Shield size={12} />
          {stageLabel}
        </div>

        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 6 }}>
          {stage === "credentials" ? "Connexion master" : stage === "email" ? "Vérification email" : "Code Authenticator"}
        </h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          {stage === "credentials" ? "Accès réservé à l'administrateur de la plateforme EduNexus."
            : stage === "email" ? `Un code a été envoyé à ${email}. Vérifie ta boîte Gmail.`
            : "Entre le code de ton application Google Authenticator ou Authy."}
        </p>

        {/* ─── ÉTAPE 1 : Credentials ─── */}
        {stage === "credentials" && (
          <form onSubmit={submit} style={{ display: "grid", gap: 16 }} autoComplete="off">
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Email</label>
              <div style={{ position: "relative" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email" required autoFocus autoComplete="off"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Adresse email"
                  style={{ ...inputStyle, paddingLeft: 42 }}
                  onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#1e3a6e"; }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Mot de passe</label>
              <div style={{ position: "relative" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type={showPassword ? "text" : "password"} required autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingLeft: 42, paddingRight: 44 }}
                  onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#1e3a6e"; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#475569", cursor: "pointer" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13 }}>{error}</div>}
            <button type="submit" disabled={submitting} style={{ ...btnPrimary, marginTop: 8 }}>
              {submitting ? "Connexion..." : <><span>Se connecter</span><ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {/* ─── ÉTAPE 2 : Email OTP ─── */}
        {stage === "email" && (
          <form onSubmit={verifyEmail} style={{ display: "grid", gap: 16 }}>
            <div style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 8, padding: "14px 16px" }}>
              <p style={{ color: "#fed7aa", fontSize: 13, lineHeight: 1.6 }}>
                📧 Code envoyé à <strong>{email}</strong>. Il expire dans 10 minutes.
              </p>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Code à 6 chiffres</label>
              <input
                type="text" inputMode="numeric" maxLength={6} autoFocus required
                value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                style={{ ...inputStyle, fontSize: 24, letterSpacing: 12, textAlign: "center" }}
                onFocus={(e) => { e.target.style.borderColor = "#fb923c"; }}
                onBlur={(e) => { e.target.style.borderColor = "#1e3a6e"; }}
              />
            </div>
            {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13 }}>{error}</div>}
            <button type="submit" disabled={submitting || emailCode.length !== 6} style={{ ...btnPrimary, background: "#ea580c", opacity: (submitting || emailCode.length !== 6) ? 0.5 : 1 }}>
              {submitting ? "Vérification..." : <><span>Valider le code email</span><ArrowRight size={16} /></>}
            </button>
            <button type="button" onClick={() => { setStage("credentials"); setEmailCode(""); setError(""); }} style={btnSecondary}>
              ← Retour aux identifiants
            </button>
          </form>
        )}

        {/* ─── ÉTAPE 3 : MFA ─── */}
        {stage === "mfa" && (
          <form onSubmit={verifyMfa} style={{ display: "grid", gap: 16 }}>
            <div style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 8, padding: "14px 16px" }}>
              <p style={{ color: "#ddd6fe", fontSize: 13, lineHeight: 1.6 }}>
                🔐 Ouvre Google Authenticator ou Authy et entre le code à 6 chiffres. Tu peux aussi utiliser un recovery code.
              </p>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Code MFA ou recovery code</label>
              <input
                type="text" autoFocus autoComplete="one-time-code" maxLength={32} required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32))}
                placeholder="123456"
                style={{ ...inputStyle, fontSize: 20, letterSpacing: 8, textAlign: "center" }}
                onFocus={(e) => { e.target.style.borderColor = "#a78bfa"; }}
                onBlur={(e) => { e.target.style.borderColor = "#1e3a6e"; }}
              />
            </div>
            {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13 }}>{error}</div>}
            <button type="submit" disabled={submitting || mfaCode.trim().length < 6} style={{ ...btnPrimary, background: "#7c3aed", opacity: (submitting || mfaCode.trim().length < 6) ? 0.5 : 1 }}>
              {submitting ? "Vérification..." : <><span>Valider le code MFA</span><ArrowRight size={16} /></>}
            </button>
            <button type="button" onClick={() => { setStage("credentials"); setMfaCode(""); setError(""); }} style={btnSecondary}>
              ← Recommencer depuis le début
            </button>
          </form>
        )}

        <p style={{ color: "#334155", fontSize: 12, marginTop: 40, textAlign: "center" }}>
          Accès réservé · EduNexus Platform © 2025
        </p>
      </div>

      </div>

      {/* CSS responsive */}
      <style>{`
        @media (min-width: 860px) {
          .login-left { display: flex !important; }
        }
        @media (max-width: 859px) {
          .login-grid-wrap { flex-direction: column !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default MasterLogin;