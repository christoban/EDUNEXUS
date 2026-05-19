import React, { useState, useEffect } from "react";
import { Shield, Key, QrCode, Copy, CheckCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import SuperAdminNavbar from "@/components/sidebar/SuperAdminNavbar";
import SensitiveDialog from "@/components/superadmin/SensitiveDialog";

const SuperAdminSecurity: React.FC = () => {
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean } | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [step, setStep] = useState<"idle" | "setup" | "confirm" | "done">("idle");
  const [loading, setLoading] = useState(false);
  const [disableDialog, setDisableDialog] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);

  // Password change
  const [pwStep, setPwStep] = useState<"idle" | "form" | "confirm">("idle");
  const [currentPw, setCurrentPw] = useState("");
  const [mfaForPw, setMfaForPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    api.get("/master/auth/mfa-status").then(({ data }) => {
      setMfaStatus({ enabled: Boolean(data.mfaEnabled) });
      // Si déjà en cours de setup, aller directement à l'étape setup
      if (data.hasPendingMfaSetup && !data.mfaEnabled) {
        // Ne pas redémarrer le setup automatiquement
      }
    }).catch(() => {});
  }, []);

  const beginMfa = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/master/auth/mfa/enable/start");
      setQrCode(data.qrCodeDataUrl || data.qrCodeUrl || data.qrCode || "");
      setManualKey(data.manualEntryKey || data.manualKey || data.secret || "");
      setStep("setup");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setLoading(false); }
  };

  const confirmMfa = async () => {
    if (!totpCode.trim()) { toast.error("Entre le code à 6 chiffres"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/master/auth/mfa/enable/confirm", { code: totpCode });
      setRecoveryCodes(data.recoveryCodes || []);
      setMfaStatus({ enabled: true });
      setStep("done");
      toast.success("MFA activée avec succès !");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Code incorrect");
    } finally { setLoading(false); }
  };

  const disableMfa = () => setDisableDialog(true);

  const confirmDisableMfa = async (password: string, code: string) => {
    setDisableLoading(true);
    try {
      await api.post("/master/auth/mfa/disable", { password, code });
      setMfaStatus({ enabled: false });
      setStep("idle");
      setDisableDialog(false);
      toast.success("MFA désactivée");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setDisableLoading(false); }
  };

  const requestPasswordChange = async () => {
    if (!currentPw.trim()) {
      toast.error("Mot de passe actuel requis");
      return;
    }
    if (mfaStatus?.enabled && !mfaForPw.trim()) {
      toast.error("Code MFA requis");
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/master/auth/password/change/start", {
        sensitiveAuth: {
          password: currentPw,
          ...(mfaStatus?.enabled && { code: mfaForPw }),
        },
      });
      setPwStep("confirm");
      toast.success("Code OTP envoyé sur ton email");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setPwLoading(false); }
  };

  const confirmPasswordChange = async () => {
    if (!newPw || !confirmPw || !emailOtp) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (newPw !== confirmPw) { toast.error("Les mots de passe ne correspondent pas"); return; }
    if (newPw.length < 8) { toast.error("Minimum 8 caractères"); return; }
    setPwLoading(true);
    try {
      await api.post("/master/auth/password/change/confirm", {
        newPassword: newPw,
        emailOtp,
      });
      toast.success("Mot de passe changé avec succès !");
      setPwStep("idle");
      setCurrentPw(""); setMfaForPw(""); setNewPw(""); setConfirmPw(""); setEmailOtp("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setPwLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: "#101828", border: "1px solid #1a2840",
    borderRadius: 12, padding: "clamp(24px,2.5vw,36px)", marginBottom: 20,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#081226", border: "1px solid #223047",
    borderRadius: 8, padding: "10px 14px", color: "#f1f5f9",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const btnPrimary: React.CSSProperties = {
    background: "#2563eb", color: "white", border: "none",
    borderRadius: 8, padding: "10px 20px", fontSize: 14,
    fontWeight: 600, cursor: "pointer",
  };

  const btnDanger: React.CSSProperties = {
    background: "#dc2626", color: "white", border: "none",
    borderRadius: 8, padding: "10px 20px", fontSize: 14,
    fontWeight: 600, cursor: "pointer",
  };

  return (
    <div>
      <SuperAdminNavbar />
      <div style={{ background: "#080c18", minHeight: "calc(100vh - 64px)", padding: "clamp(40px,5vh,64px) clamp(32px,5vw,80px)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 6 }}>
            Sécurité du compte
          </h1>
          <p style={{ color: "#64748b", marginBottom: 32, fontSize: 15 }}>
            Gérer la MFA et le mot de passe du compte Super Admin
          </p>

          {/* MFA Section */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: mfaStatus?.enabled ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={20} color={mfaStatus?.enabled ? "#4ade80" : "#f87171"} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#f1f5f9" }}>Authentification à deux facteurs</div>
                <div style={{ fontSize: 13, color: mfaStatus?.enabled ? "#4ade80" : "#f87171", marginTop: 2 }}>
                  {mfaStatus?.enabled ? "✓ Activée" : "✗ Désactivée"}
                </div>
              </div>
            </div>

            {step === "idle" && (
              <>
                {!mfaStatus?.enabled ? (
                  <button onClick={beginMfa} disabled={loading} style={btnPrimary}>
                    {loading ? "Chargement..." : "Activer la MFA →"}
                  </button>
                ) : (
                  <button onClick={disableMfa} disabled={loading} style={btnDanger}>
                    {loading ? "Chargement..." : "Désactiver la MFA"}
                  </button>
                )}
              </>
            )}

            {step === "setup" && (
              <div style={{ display: "grid", gap: 20 }}>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>
                  1. Scanne ce QR code avec Google Authenticator ou Authy
                </p>
                <div style={{ background: "white", padding: 16, borderRadius: 8, display: "inline-block" }}>
                  {qrCode ? (
                    <img src={qrCode} alt="QR Code MFA" style={{ width: 200, height: 200, display: "block" }} />
                  ) : (
                    <div style={{ width: 200, height: 200, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #3b82f6", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
                    </div>
                  )}
                </div>
                {manualKey && (
                  <div>
                    <p style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>
                      Ou entre cette clé manuellement :
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <code style={{ background: "#0d1825", color: "#7dd3fc", padding: "8px 14px", borderRadius: 6, fontSize: 14, letterSpacing: 2, border: "1px solid #1e3a6e" }}>
                        {manualKey}
                      </code>
                      <button onClick={() => { navigator.clipboard.writeText(manualKey); toast.success("Clé copiée"); }}
                        style={{ background: "transparent", border: "1px solid #1e3a6e", color: "#7dd3fc", borderRadius: 6, padding: "8px 12px", cursor: "pointer" }}>
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>
                    2. Entre le code à 6 chiffres de l'application :
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      style={{ ...inputStyle, width: 160, fontSize: 20, textAlign: "center", letterSpacing: 8 }}
                    />
                    <button onClick={confirmMfa} disabled={loading || totpCode.length !== 6} style={btnPrimary}>
                      {loading ? "Vérification..." : "Confirmer"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === "done" && recoveryCodes.length > 0 && (
              <div>
                <div style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                  <p style={{ color: "#fde047", fontWeight: 700, marginBottom: 4 }}>⚠️ Sauvegarde ces codes de récupération !</p>
                  <p style={{ color: "#fef9c3", fontSize: 13 }}>Chaque code ne peut être utilisé qu'une seule fois. Conserve-les dans un endroit sûr.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {recoveryCodes.map((code, i) => (
                    <code key={i} style={{ background: "#0d1825", color: "#7dd3fc", padding: "8px 14px", borderRadius: 6, fontSize: 13, border: "1px solid #1e3a6e", fontFamily: "monospace" }}>
                      {code}
                    </code>
                  ))}
                </div>
                <button onClick={() => setStep("idle")} style={{ ...btnPrimary, marginTop: 16 }}>
                  J'ai sauvegardé mes codes →
                </button>
              </div>
            )}
          </div>

          {/* Password Section */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Key size={20} color="#60a5fa" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#f1f5f9" }}>Mot de passe</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Changer le mot de passe du compte</div>
              </div>
            </div>

            {pwStep === "idle" ? (
              <button onClick={() => setPwStep("form")} style={btnPrimary}>
                Changer le mot de passe →
              </button>
            ) : pwStep === "form" ? (
              <div style={{ display: "grid", gap: 14 }}>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>
                  Entre ton mot de passe actuel{mfaStatus?.enabled && " et ton code MFA"} pour initier le changement.
                </p>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Mot de passe actuel"
                  style={inputStyle}
                />
                {mfaStatus?.enabled && (
                  <input
                    value={mfaForPw}
                    onChange={(e) => setMfaForPw(e.target.value)}
                    placeholder="Code MFA (6 chiffres)"
                    style={{ ...inputStyle, letterSpacing: 6, textAlign: "center" }}
                  />
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={requestPasswordChange} disabled={pwLoading} style={btnPrimary}>
                    {pwLoading ? "Envoi..." : "Continuer →"}
                  </button>
                  <button onClick={() => { setPwStep("idle"); setCurrentPw(""); setMfaForPw(""); }}
                    style={{ background: "transparent", color: "#64748b", border: "1px solid #1a2840", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>
                  Un code OTP a été envoyé sur ton email. Entre-le avec ton nouveau mot de passe.
                </p>
                <div style={{ position: "relative" }}>
                  <input
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    type={showPw ? "text" : "password"}
                    placeholder="Nouveau mot de passe (min 8 caractères)"
                    style={inputStyle}
                  />
                  <button onClick={() => setShowPw(!showPw)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
                <input
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  type="password"
                  placeholder="Confirmer le nouveau mot de passe"
                  style={inputStyle}
                />
                <input
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                  placeholder="Code OTP reçu par email"
                  style={{ ...inputStyle, letterSpacing: 4, textAlign: "center" }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={confirmPasswordChange} disabled={pwLoading} style={btnPrimary}>
                    {pwLoading ? "Changement..." : "Confirmer le changement"}
                  </button>
                  <button onClick={() => { setPwStep("idle"); setNewPw(""); setConfirmPw(""); setEmailOtp(""); }}
                    style={{ background: "transparent", color: "#64748b", border: "1px solid #1a2840", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {disableDialog && (
        <SensitiveDialog
          title="Désactiver la MFA"
          onConfirm={confirmDisableMfa}
          onCancel={() => setDisableDialog(false)}
          loading={disableLoading}
        />
      )}
    </div>
  );
};

export default SuperAdminSecurity;