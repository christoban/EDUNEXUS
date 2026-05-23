import React, { useEffect, useState, useMemo } from "react";
import { Copy, ExternalLink, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import SuperAdminNavbar from "@/components/sidebar/SuperAdminNavbar";
import SensitiveDialog from "@/components/superadmin/SensitiveDialog";

type Request = {
  _id: string;
  schoolName: string;
  systemType: string;
  templateKey: string | null;
  onboardingStatus: string;
  requestedAdminEmail: string | null;
  requestedAdminName: string | null;
  createdAt: string;
  latestInvite: {
    token: string;
    status: string;
    expiresAt: string;
    requestedAdminEmail: string;
  } | null;
};

const SuperAdminRequests: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ action: string; schoolId: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/onboarding/requests");
      setRequests(data.requests || []);
    } catch { toast.error("Impossible de charger les demandes"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  useEffect(() => {
    api.get("/master/auth/mfa-status")
      .then(({ data }) => setMfaEnabled(Boolean(data.mfaEnabled)))
      .catch(() => setMfaEnabled(false));
  }, []);

  const filtered = useMemo(() => {
    return requests
      .filter((r) => filter === "all" || r.onboardingStatus === filter)
      .filter((r) => !search.trim() || r.schoolName.toLowerCase().includes(search.toLowerCase()) || (r.requestedAdminEmail ?? "").toLowerCase().includes(search.toLowerCase()));
  }, [requests, filter, search]);

  const handleAction = (action: string, schoolId: string) => {
    setDialog({ action, schoolId });
  };

  const confirmAction = async (password: string, code: string) => {
    if (!dialog) return;
    setActionLoading(true);
    try {
      const { action, schoolId } = dialog;
      const auth = { sensitiveAuth: { password, code } };
      if (action === "approve") await api.post(`/onboarding/requests/${schoolId}/approve`, auth);
      else if (action === "reject") await api.post(`/onboarding/requests/${schoolId}/reject`, auth);
      toast.success(action === "approve" ? "Demande approuvée ✓" : "Demande rejetée");
      setDialog(null);
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Action impossible");
    } finally { setActionLoading(false); }
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/onboarding/join/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Lien copié !");
  };

  const statusColors: Record<string, string> = {
    pending: "#fb923c", approved: "#60a5fa", active: "#4ade80",
    rejected: "#f87171", provisioning: "#c084fc",
  };

  return (
    <div>
      <SuperAdminNavbar />
      <div style={{ background: "#080c18", minHeight: "calc(100vh - 64px)", padding: "clamp(40px,5vh,64px) clamp(32px,5vw,80px)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 4 }}>Demandes d'établissements</h1>
              <p style={{ color: "#64748b", fontSize: 15 }}>Gérer les demandes d'onboarding et les invitations</p>
            </div>
            <button onClick={fetchRequests} disabled={loading}
              style={{ background: "transparent", border: "1px solid #1a2840", color: "#94a3b8", borderRadius: 8, padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <RefreshCcw size={14} />
              Actualiser
            </button>
          </div>

          {/* Filtres */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {["all", "pending", "approved", "active", "rejected"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? "rgba(59,130,246,0.15)" : "transparent",
                  color: filter === f ? "#60a5fa" : "#64748b",
                  border: filter === f ? "1px solid rgba(59,130,246,0.3)" : "1px solid #1a2840",
                  borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, textTransform: "capitalize",
                }}>
                {f === "all" ? "Tous" : f}
                <span style={{ marginLeft: 8, background: "#1a2840", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>
                  {f === "all" ? requests.length : requests.filter((r) => r.onboardingStatus === f).length}
                </span>
              </button>
            ))}
          </div>

          {/* Recherche */}
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par école ou email..."
            style={{ width: "100%", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 16px", color: "#e2e8f0", fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

          {/* Table */}
          <div style={{ background: "#101828", border: "1px solid #1a2840", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0d1225" }}>
                <tr>
                  {["Établissement", "Statut", "Admin demandé", "Invitation", "Date", "Actions"].map((h) => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569", padding: "12px 20px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "#4b6070", padding: 40 }}>Chargement...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "#4b6070", padding: 40 }}>Aucun résultat</td></tr>
                ) : filtered.map((req) => (
                  <tr key={req._id} style={{ borderBottom: "1px solid #0f1825" }}>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{req.schoolName}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{req.templateKey || req.systemType}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ background: "rgba(0,0,0,0.3)", color: statusColors[req.onboardingStatus] ?? "#94a3b8", border: `1px solid ${statusColors[req.onboardingStatus] ?? "#334155"}33`, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                        {req.onboardingStatus}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>{req.requestedAdminName || "—"}</div>
                      <div style={{ color: "#475569", fontSize: 12 }}>{req.requestedAdminEmail || "—"}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      {req.latestInvite ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => copyInviteLink(req.latestInvite!.token)}
                            style={{ background: "transparent", border: "1px solid #1a2840", color: "#64748b", borderRadius: 6, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                            <Copy size={12} /> Copier
                          </button>
                          <button onClick={() => window.open(`${window.location.origin}/onboarding/join/${req.latestInvite!.token}`, "_blank")}
                            style={{ background: "transparent", border: "1px solid #1a2840", color: "#64748b", borderRadius: 6, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      ) : <span style={{ color: "#334155", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "16px 20px", color: "#64748b", fontSize: 13 }}>
                      {new Date(req.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {req.onboardingStatus === "pending" && (
                          <>
                            <button onClick={() => handleAction("approve", req._id)}
                              style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                              Approuver
                            </button>
                            <button onClick={() => handleAction("reject", req._id)}
                              style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                              Rejeter
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {dialog && (
        <SensitiveDialog
          title={dialog.action === "approve" ? "Confirmer l'approbation" : "Confirmer le rejet"}
          onConfirm={confirmAction}
          onCancel={() => setDialog(null)}
          loading={actionLoading}
            mfaEnabled={mfaEnabled}
        />
      )}
    </div>
  );
};

export default SuperAdminRequests;