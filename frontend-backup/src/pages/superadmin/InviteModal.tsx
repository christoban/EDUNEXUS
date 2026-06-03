import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface InviteModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<"details" | "confirm">("details");
  const [email, setEmail] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/master/auth/mfa-status")
      .then(({ data }) => setMfaEnabled(Boolean(data.mfaEnabled)))
      .catch(() => setMfaEnabled(false));
  }, []);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("L'email est requis.");
      return;
    }
    if (!schoolName.trim()) {
      toast.error("Le nom de l'établissement est requis.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast.error("Le mot de passe master est requis.");
      return;
    }
    if (mfaEnabled === true && !mfaCode.trim()) {
      toast.error("Le code MFA est requis.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post("/master/schools/invite", {
        requestedAdminEmail: email.trim(),
        schoolName: schoolName.trim(),
        sensitiveAuth: {
          password,
          ...(mfaEnabled === true && { code: mfaCode }),
        },
      });
      toast.success(`Invitation envoyée à ${email}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const message = err?.response?.data?.message || "Erreur lors de l'envoi de l'invitation.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(0,0,0,.82)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0d1225",
          borderLeft: "1px solid #223050",
          borderRight: "1px solid #223050",
          borderBottom: "1px solid #223050",
          borderTop: "3px solid #2563eb",
          borderRadius: 14,
          padding: 30,
          width: 420,
          maxWidth: "95vw",
          boxShadow: "0 24px 60px rgba(0,0,0,.6)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>
          ✉ Inviter un établissement
        </h2>
        <p style={{ fontSize: 13, color: "#4b6070", marginBottom: 24 }}>
          Un lien d'inscription sera envoyé à l'administrateur qui pourra saisir les informations de son établissement.
        </p>

        {step === "details" ? (
          <form onSubmit={handleDetailsSubmit}>
            <label style={labelStyle}>NOM DE L'ÉTABLISSEMENT *</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              required
              placeholder="Lycée de la Réussite"
              style={inputStyle}
            />

            <label style={labelStyle}>EMAIL DE L'ÉTABLISSEMENT *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@ecole.cm"
              style={inputStyle}
            />

            {error && (
              <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  background: "#131f35",
                  border: "1px solid #223050",
                  color: "#94a3b8",
                  fontWeight: 600,
                  padding: 12,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2,
                  background: "#2563eb",
                  color: "white",
                  fontWeight: 800,
                  padding: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                Continuer →
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmSubmit}>
            <div style={{ background: "#0b1220", border: "1px solid #223050", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Établissement</div>
              <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>{schoolName}</div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 10, marginBottom: 6 }}>Email</div>
              <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>{email}</div>
            </div>

            <label style={labelStyle}>MOT DE PASSE MASTER *</label>
            {/* prevent browser autofill */}
            <input type="text" name="__autocomplete_username" style={{ display: "none" }} />
            <input type="password" name="__autocomplete_password" style={{ display: "none" }} />
            <input
              type="password"
              name="master_auth_password"
              autoComplete="new-password"
              autoCorrect="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mot de passe master"
              style={inputStyle}
            />

            {mfaEnabled === true && (
              <>
                <label style={labelStyle}>CODE MFA *</label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="Code MFA (6 chiffres)"
                  style={inputStyle}
                />
              </>
            )}

            {error && (
              <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setStep("details")}
                style={{
                  flex: 1,
                  background: "#131f35",
                  border: "1px solid #223050",
                  color: "#94a3b8",
                  fontWeight: 600,
                  padding: 12,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2,
                  background: "#2563eb",
                  color: "white",
                  fontWeight: 800,
                  padding: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Envoi..." : "Envoyer l'invitation →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".8px",
  color: "#4b6070",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#080c18",
  border: "1px solid #223050",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#f1f5f9",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 16,
};

export default InviteModal;