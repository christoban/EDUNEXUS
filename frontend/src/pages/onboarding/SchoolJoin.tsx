import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function SchoolJoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Formulaire étape 2
  const [form, setForm] = useState({
    schoolName: "",
    schoolMotto: "",
    adminName: "",
    adminEmail: "",
    phone: "",
    location: "",
    templateKey: "fr_secondary",
    plan: "standard",
    adminPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await api.get(`/onboarding/join/${token}`);
        setInvite(res.data.invite);
        setSchool(res.data.school || null);
        
        // Pré-remplir avec les données de l'invitation
        if (res.data.invite) {
          setForm(prev => ({
            ...prev,
            schoolName: res.data.invite.schoolName || prev.schoolName,
            adminName: res.data.invite.requestedAdminName || prev.adminName,
            adminEmail: res.data.invite.requestedAdminEmail || prev.adminEmail,
            templateKey: res.data.invite.templateKey || prev.templateKey,
            plan: res.data.invite.plan || prev.plan,
          }));
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Invitation invalide ou expirée";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.schoolName.trim()) {
      toast.error("Le nom de l'établissement est requis");
      return;
    }
    if (!form.adminName.trim()) {
      toast.error("Le nom de l'administrateur est requis");
      return;
    }
    if (!form.adminEmail.trim()) {
      toast.error("L'email de l'administrateur est requis");
      return;
    }
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
      const res = await api.post(`/onboarding/join/${token}`, {
        schoolName: form.schoolName,
        schoolMotto: form.schoolMotto,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        phone: form.phone,
        location: form.location,
        templateKey: form.templateKey,
        plan: form.plan,
        adminPassword: form.adminPassword,
        confirmPassword: form.confirmPassword,
      });
      
      toast.success(res.data.message || "Demande soumise avec succès!");
      setSchool(res.data.school);
      
      // Afficher un message indiquant que l'école est en attente d'approbation
      toast.info("Votre établissement est en attente d'approbation par le Super Admin.");
      
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: "#64748b", textAlign: "center" }}>Vérification de l'invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h1 style={{ color: "#f1f5f9", fontSize: 20, marginBottom: 8 }}>Invitation invalide</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  // Si l'école est déjà en pending ou approved, afficher le statut
  if (school && (school.onboardingStatus === "pending" || school.onboardingStatus === "approved")) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ color: "#f1f5f9", fontSize: 20, marginBottom: 8 }}>
            Demande en cours d'examen
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Votre établissement <strong style={{ color: "#fff" }}>{school.schoolName}</strong> est en statut : 
            <span style={{ color: "#3b82f6" }}>{school.onboardingStatus}</span>
          </p>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 12 }}>
            Vous recevrez un email d'activation une fois approuvé par le Super Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
            🎉 Complétez votre inscription
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Établissement : <strong style={{ color: "#fff" }}>{invite?.schoolName || "Nouveau"}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>NOM DE L'ÉTABLISSEMENT *</label>
            <input
              type="text"
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              required
              placeholder="Nom de votre établissement"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>DEVIE DE L'ÉTABLISSEMENT</label>
            <input
              type="text"
              value={form.schoolMotto}
              onChange={(e) => setForm({ ...form, schoolMotto: e.target.value })}
              placeholder="Ex: Excellence, Intégrité, Succès"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>EMAIL ADMIN *</label>
              <input
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                required
                disabled
                style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
            <div>
              <label style={labelStyle}>NOM ADMIN *</label>
              <input
                type="text"
                value={form.adminName}
                onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                required
                placeholder="Votre nom complet"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>TÉLÉPHONE</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+237 6XX XXX XXX"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>LOCALISATION</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Douala, Cameroun"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>MOT DE PASSE *</label>
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
            disabled={submitting || !form.schoolName || !form.adminName}
            style={{
              background: submitting ? "#1e40af" : "#3b82f6",
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
            {submitting ? "Soumission..." : "Soumettre ma demande"}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "#475569", marginTop: 20, textAlign: "center" }}>
          En confirmant, vous acceptez les conditions d'utilisation d'EduNexus.
          Votre établissement sera en statut "pending" en attente d'approbation.
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
  maxWidth: 600,
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
