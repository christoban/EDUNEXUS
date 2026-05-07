import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import SuperAdminNavbar from "@/components/sidebar/SuperAdminNavbar";

type School = {
  _id: string;
  schoolName: string;
  systemType: string;
  templateKey: string;
  onboardingStatus: string;
  isActive: boolean;
  requestedAdminName: string | null;
  requestedAdminEmail: string | null;
  location: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  dbName: string;
  createdAt: string;
  updatedAt: string;
};

type ActivityLog = {
  _id: string;
  action: string;
  details: string;
  createdAt: string;
};

interface SchoolDetailPageProps {
  school: School;
  onBack: () => void;
  onRefresh: () => void;
  onSuspend?: () => void;
}

const SchoolDetailPage: React.FC<SchoolDetailPageProps> = ({ school, onBack, onRefresh }) => {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoadingLogs(true);
      try {
        const response = await api.get(`/master/schools/${school._id}/activity-logs`);
        setActivityLogs(response.data.logs || []);
      } catch {
        setActivityLogs([]);
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [school._id]);

  const handleSuspend = async () => {
    const password = window.prompt("Confirme ton mot de passe master:") || "";
    if (!password.trim()) {
      toast.error("Mot de passe requis.");
      return;
    }

    const code = window.prompt("Entre ton code MFA:") || "";
    if (!code.trim()) {
      toast.error("Code MFA requis.");
      return;
    }

    setSuspending(true);
    try {
      await api.post(`/master/schools/${school._id}/suspend`, {
        sensitiveAuth: { password, code },
      });
      toast.success("École suspendue");
      onRefresh();
      onBack();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Action impossible.");
    } finally {
      setSuspending(false);
    }
  };

  const handleReactivate = async () => {
    const password = window.prompt("Confirme ton mot de passe master:") || "";
    if (!password.trim()) {
      toast.error("Mot de passe requis.");
      return;
    }

    const code = window.prompt("Entre ton code MFA:") || "";
    if (!code.trim()) {
      toast.error("Code MFA requis.");
      return;
    }

    setSuspending(true);
    try {
      await api.post(`/master/schools/${school._id}/reactivate`, {
        sensitiveAuth: { password, code },
      });
      toast.success("École réactivée");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Action impossible.");
    } finally {
      setSuspending(false);
    }
  };

  const handleDelete = async () => {
    if (deleteInput !== "SUPPRIMER") {
      toast.error("Tapez SUPPRIMER pour confirmer.");
      return;
    }

    const password = window.prompt("Confirme ton mot de passe master:") || "";
    if (!password.trim()) {
      toast.error("Mot de passe requis.");
      return;
    }

    const code = window.prompt("Entre ton code MFA:") || "";
    if (!code.trim()) {
      toast.error("Code MFA requis.");
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/master/schools/${school._id}`, {
        data: { sensitiveAuth: { password, code } },
      });
      toast.success("École supprimée");
      onRefresh();
      onBack();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Suppression impossible.");
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div>
      <SuperAdminNavbar />

      <div style={{ minHeight: "calc(100vh - 64px)", background: "#080c18", padding: "clamp(40px,5vh,64px) clamp(24px,5vw,80px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <button
            onClick={onBack}
            style={{
              color: "#60a5fa",
              background: "transparent",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Retour au Hub
          </button>
          <div style={{ fontSize: 11, color: "#4b6070", marginTop: 4, marginBottom: 20 }}>
            Hub de Contrôle › Gestion active › Fiche
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9" }}>
            Gestion : {school.schoolName}
          </h1>
          <p style={{ fontSize: 13, color: "#4b6070", marginTop: 4, marginBottom: 24 }}>
            Fiche détaillée
          </p>

          <div
            style={{
              background: "#101828",
              border: "1px solid #1a2840",
              borderRadius: 12,
              padding: "clamp(24px,2.5vw,36px)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: "linear-gradient(135deg, #1e3a6e, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#bfdbfe",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {getInitials(school.schoolName)}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: "white" }}>
                  {school.schoolName}
                </span>
                <span
                  style={{
                    background: school.isActive ? "#052e16" : "#1a0505",
                    color: school.isActive ? "#4ade80" : "#f87171",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {school.isActive ? "ACTIF" : "INACTIF"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#4b6070", marginTop: 4 }}>
                {school.dbName}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ background: "#101828", border: "1px solid #1a2840", borderRadius: 12, padding: "clamp(24px,2.5vw,36px)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.4px", color: "#4b6070", borderBottom: "1px solid #1a2840", paddingBottom: 10, marginBottom: 12 }}>GÉNÉRAL</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#64748b" }}>Adresse</span><span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{school.location || "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#64748b" }}>Téléphone</span><span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{school.contactPhone || "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#64748b" }}>Type</span><span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{school.systemType}</span></div>
            </div>

            <div style={{ background: "#101828", border: "1px solid #1a2840", borderRadius: 12, padding: "clamp(24px,2.5vw,36px)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.4px", color: "#4b6070", borderBottom: "1px solid #1a2840", paddingBottom: 10, marginBottom: 12 }}>CONFIGURATION TECHNIQUE</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#64748b" }}>Base</span><span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{school.dbName}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#64748b" }}>Email admin</span><span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{school.requestedAdminEmail || "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#64748b" }}>Statut</span><span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{school.onboardingStatus}</span></div>
            </div>

            <div style={{ background: "#101828", border: "1px solid #1a2840", borderRadius: 12, padding: "clamp(24px,2.5vw,36px)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.4px", color: "#4b6070", borderBottom: "1px solid #1a2840", paddingBottom: 10, marginBottom: 12 }}>JOURNAL D'AUDIT</div>
              {loadingLogs ? <span style={{ color: "#4b6070" }}>Chargement...</span> : activityLogs.length === 0 ? <span style={{ color: "#4b6070" }}>Aucune activité</span> : activityLogs.slice(0, 5).map((log) => (
                <div key={log._id} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 6px rgba(59,130,246,.5)", marginTop: 4, flexShrink: 0 }} />
                  <div><span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{log.action}</span><div style={{ fontSize: 11, color: "#4b6070", marginTop: 2 }}>{new Date(log.createdAt).toLocaleDateString("fr-FR")}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#100808", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 12, padding: "clamp(24px,3vw,36px)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#f87171", marginBottom: 16 }}>⚠ ZONE DE DANGER</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {school.isActive ? (
                <div>
                  <button onClick={handleSuspend} disabled={suspending} style={{ background: "#d97706", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}>⏸ Suspendre</button>
                  <p style={{ fontSize: 11, color: "#5a1e1e", marginTop: 6 }}>Bloquer l'accès sans supprimer les données</p>
                </div>
              ) : (
                <div>
                  <button onClick={handleReactivate} disabled={suspending} style={{ background: "#16a34a", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}>✓ Réactiver</button>
                  <p style={{ fontSize: 11, color: "#5a1e1e", marginTop: 6 }}>Restaurer l'accès à l'école</p>
                </div>
              )}
              <div>
                {!showDeleteConfirm ? (
                  <>
                    <button onClick={() => setShowDeleteConfirm(true)} style={{ background: "#dc2626", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}>🗑 Supprimer</button>
                    <p style={{ fontSize: 11, color: "#5a1e1e", marginTop: 6 }}>Action irréversible - toutes les données seront perdues</p>
                  </>
                ) : (
                  <>
                    <input type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} placeholder="Tapez SUPPRIMER" style={{ background: "#080c18", border: "1px solid #223050", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13, outline: "none", width: "100%", marginBottom: 10 }} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }} style={{ background: "#131f35", border: "1px solid #223050", color: "#94a3b8", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                      <button onClick={handleDelete} disabled={deleting || deleteInput !== "SUPPRIMER"} style={{ background: "#dc2626", color: "white", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", opacity: deleting || deleteInput !== "SUPPRIMER" ? 0.7 : 1 }}>{deleting ? "..." : "Confirmer"}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolDetailPage;