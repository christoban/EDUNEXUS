import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function SchoolActivatePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    adminPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await api.get(`/onboarding/join/${token}`);
        setInvite(res.data.invite);
        if (res.data.invite?.type !== "activation") {
          setError("Ce lien n'est pas un lien d'activation");
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Lien d'activation invalide ou expiré";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.adminPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (form.adminPassword !== form.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/onboarding/activate/${token}`, {
        adminPassword: form.adminPassword,
        confirmPassword: form.confirmPassword,
      });
      
      toast.success(res.data.message || "Établissement activé avec succès!");
      
      if (res.data.school?.loginUrl) {
        setTimeout(() => {
          window.location.href = res.data.school.loginUrl;
        }, 2000);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'activation");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: "#64748b", textAlign: "center" }}>Vérification du lien d'activation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h1 style={{ color: "#f1f5f9", fontSize: 20, marginBottom: 8 }}>Lien invalide</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
            🔐 Activez votre espace
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Établissement : <strong style={{ color: "#fff" }}>{invite?.schoolName || "Votre école"}</strong>
          </p>
          <p style={{ color: "#10b981", fontSize: 13, marginTop: 8 }}>
            ✅ Votre établissement a été approuvé par le Super Admin
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>MOT DE PASSE ADMIN *</label>
            <input
              type="password"
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              required
              minLength={6}
              placeholder="minimum 6 caractères"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>CONFIRMER LE MOT DE PASSE *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
              placeholder="Confirmer votre mot de passe"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || form.adminPassword.length < 6}
            style={{
              background: submitting ? "#1e40af" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "14px 0",
              fontSize: 16,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
              marginTop: 8,
            }}
          >
            {submitting ? "Activation..." : "🚀 Activer mon espace"}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "#475569", marginTop: 20, textAlign: "center" }}>
          En activant, vous acceptez les conditions d'utilisation d'EduNexus.
          <br />
          Vous serez redirigé vers la page de connexion après activation.
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0d14",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 16,
  padding: "32px 28px",
  width: "100%",
  maxWidth: 480,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".8px",
  color: "#64748b",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "12px 14px",
  color: "#f1f5f9",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
