import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Copy, ExternalLink, RefreshCcw, Search } from "lucide-react";
import SuperAdminNavbar from "@/components/sidebar/SuperAdminNavbar";
import InviteModal from "./InviteModal";

const SchoolDetailPageLazy = lazy(() =>
  import("./SchoolDetailPage").then((m) => ({ default: m.default }))
);

// ─── Types ────────────────────────────────────────────────────

type FilterStatus = "all" | "pending" | "rejected" | "approved" | "active" | "suspended";

type School = {
  _id: string;
  schoolName: string;
  systemType: string;
  templateKey: string | null;
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
  latestInvite: {
    token: string;
    status: string;
    expiresAt: string;
    requestedAdminEmail: string;
    requestedAdminName: string;
    metadata?: { plan?: string };
  } | null;
};

// ─── SensitiveDialog ─────────────────────────────────────────

const SensitiveDialog: React.FC<{
  title: string;
  onConfirm: (password: string, code: string) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ title, onConfirm, onCancel, loading }) => {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#081226", border: "1px solid #223047",
    borderRadius: 8, padding: "10px 14px", color: "#f1f5f9",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ width: 480, background: "#0b1220", borderRadius: 12, padding: 24, border: "1px solid #223047", boxShadow: "0 24px 60px rgba(0,0,0,.6)" }}>
        <h3 style={{ color: "#f8fafc", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{title}</h3>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
          Saisis ton mot de passe master et ton code MFA pour confirmer cette action.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe master" style={inputStyle} autoFocus />
          <input value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="Code MFA (6 chiffres) ou recovery code"
            style={{ ...inputStyle, letterSpacing: 4, textAlign: "center" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={onCancel}
              style={{ background: "transparent", border: "1px solid #223047", color: "#94a3b8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
              Annuler
            </button>
            <button
              onClick={() => onConfirm(password, code)}
              disabled={loading || !password.trim() || !code.trim()}
              style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: (loading || !password.trim() || !code.trim()) ? 0.5 : 1 }}>
              {loading ? "..." : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────

const DashboardSuperAdmin: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activePage, setActivePage] = useState<"hub" | "detail">("hub");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  // SensitiveDialog state
  const [sensitiveDialog, setSensitiveDialog] = useState<{ action: string; schoolId: string; label: string } | null>(null);
  const [sensitiveLoading, setSensitiveLoading] = useState(false);

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/master/schools");
      setSchools(response.data.schools || []);
    } catch {
      toast.error("Erreur lors du chargement des établissements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchools(); }, [fetchSchools]);

  // ─── Compteurs ────────────────────────────────────────────
  const counts = useMemo(() => ({
    all: schools.length,
    pending: schools.filter((s) => s.onboardingStatus === "pending").length,
    rejected: schools.filter((s) => s.onboardingStatus === "rejected").length,
    approved: schools.filter((s) => s.onboardingStatus === "approved").length,
    active: schools.filter((s) => s.onboardingStatus === "active" && s.isActive).length,
    suspended: schools.filter((s) => s.onboardingStatus === "active" && !s.isActive).length,
  }), [schools]);

  // ─── Filtrage ─────────────────────────────────────────────
  const filteredSchools = useMemo(() => {
    let filtered = schools;

    if (activeFilter === "active") {
      filtered = filtered.filter((s) => s.onboardingStatus === "active" && s.isActive);
    } else if (activeFilter === "suspended") {
      filtered = filtered.filter((s) => s.onboardingStatus === "active" && !s.isActive);
    } else if (activeFilter !== "all") {
      filtered = filtered.filter((s) => s.onboardingStatus === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) =>
        s.schoolName.toLowerCase().includes(q) ||
        (s.requestedAdminEmail ?? "").toLowerCase().includes(q) ||
        (s.requestedAdminName ?? "").toLowerCase().includes(q) ||
        (s.dbName ?? "").toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [schools, activeFilter, searchQuery]);

  // ─── Actions ──────────────────────────────────────────────
  const openAction = (action: string, schoolId: string) => {
    const labels: Record<string, string> = {
      approve: "Confirmer l'approbation",
      reject: "Confirmer le rejet",
      reactivate: "Confirmer la réactivation",
      suspend: "Confirmer la suspension",
      relaunch: "Relancer l'invitation",
    };
    if (action === "manage") {
      const school = schools.find((s) => s._id === schoolId);
      if (school) { setSelectedSchool(school); setActivePage("detail"); }
      return;
    }
    setSensitiveDialog({ action, schoolId, label: labels[action] ?? "Confirmer l'action" });
  };

  const confirmAction = async (password: string, code: string) => {
    if (!sensitiveDialog) return;
    setSensitiveLoading(true);
    try {
      const { action, schoolId } = sensitiveDialog;
      const auth = { sensitiveAuth: { password, code } };
      if (action === "approve") {
        await api.post(`/onboarding/requests/${schoolId}/approve`, auth);
        toast.success("Établissement approuvé ✓");
      } else if (action === "reject") {
        await api.post(`/onboarding/requests/${schoolId}/reject`, auth);
        toast.success("Demande rejetée");
      } else if (action === "reactivate") {
        await api.post(`/master/schools/${schoolId}/reactivate`, auth);
        toast.success("École réactivée ✓");
      } else if (action === "suspend") {
        await api.post(`/master/schools/${schoolId}/suspend`, auth);
        toast.success("École suspendue");
      } else if (action === "relaunch") {
        await api.post(`/master/schools/${schoolId}/invite/resend`, auth);
        toast.success("Invitation relancée ✓");
      }
      setSensitiveDialog(null);
      await fetchSchools();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Action impossible");
    } finally {
      setSensitiveLoading(false);
    }
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/onboarding/join/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Lien d'invitation copié !");
  };

  // ─── Styles ───────────────────────────────────────────────
  const filterConfig: Record<FilterStatus, { label: string; color: string; bg: string; border: string; activeBorder: string; glow: string; badgeBg: string }> = {
    all:       { label: "Tous",      color: "#94a3b8", bg: "#0d1122", border: "#1e293b", activeBorder: "#475569", glow: "rgba(71,85,105,.15)", badgeBg: "#1e293b" },
    pending:   { label: "Pending",   color: "#fb923c", bg: "#160f04", border: "#92400e", activeBorder: "#f97316", glow: "rgba(249,115,22,.15)", badgeBg: "#7c2d12" },
    approved:  { label: "Approved",  color: "#60a5fa", bg: "#04091a", border: "#1e3a6e", activeBorder: "#3b82f6", glow: "rgba(59,130,246,.15)", badgeBg: "#1e3a8a" },
    active:    { label: "Active",    color: "#4ade80", bg: "#041208", border: "#166534", activeBorder: "#22c55e", glow: "rgba(34,197,94,.15)",  badgeBg: "#14532d" },
    rejected:  { label: "Rejected",  color: "#f87171", bg: "#160404", border: "#991b1b", activeBorder: "#ef4444", glow: "rgba(239,68,68,.15)",  badgeBg: "#7f1d1d" },
    suspended: { label: "Suspended", color: "#fca5a5", bg: "#1a0505", border: "#7f1d1d", activeBorder: "#ef4444", glow: "rgba(239,68,68,.15)",  badgeBg: "#450a0a" },
  };

  const getPlanStyle = (plan?: string) => {
    if (plan === "premium") return { bg: "#052e16", color: "#86efac", border: "#166534" };
    if (plan === "standard") return { bg: "#271900", color: "#fcd34d", border: "#451a03" };
    return { bg: "#1a0505", color: "#fca5a5", border: "#7f1d1d" };
  };

  // ─── Vue detail ───────────────────────────────────────────
  if (activePage === "detail" && selectedSchool) {
    return (
      <Suspense fallback={<div style={{ background: "#080c18", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#4b6070" }}>Chargement...</div>}>
        <SchoolDetailPageLazy
          school={selectedSchool}
          onBack={() => setActivePage("hub")}
          onRefresh={fetchSchools}
        />
      </Suspense>
    );
  }

  // ─── Vue hub ──────────────────────────────────────────────
  return (
    <div>
      <SuperAdminNavbar onInviteClick={() => setShowInviteModal(true)} />

      <div style={{ background: "#080c18", minHeight: "calc(100vh - 64px)", padding: "clamp(40px,5vh,64px) clamp(32px,5vw,80px)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}>

          {/* En-tête */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 6 }}>
                Hub de Contrôle
              </h1>
              <p style={{ fontSize: 15, color: "#64748b" }}>
                Gestion centralisée des établissements EduNexus
              </p>
            </div>
            <button
              onClick={() => { setLoading(true); fetchSchools(); }}
              style={{ background: "transparent", border: "1px solid #1a2840", color: "#64748b", borderRadius: 8, padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <RefreshCcw size={14} />
              Actualiser
            </button>
          </div>

          {/* Filtres / KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
            {(Object.keys(filterConfig) as FilterStatus[]).map((status) => {
              const cfg = filterConfig[status];
              const isSelected = activeFilter === status;
              return (
                <div key={status} onClick={() => setActiveFilter(status)}
                  style={{
                    padding: "18px 20px", borderRadius: 12, cursor: "pointer",
                    transition: "border-color .15s, box-shadow .15s",
                    border: isSelected ? `2px solid ${cfg.activeBorder}` : `2px solid ${cfg.border}`,
                    background: cfg.bg,
                    boxShadow: isSelected ? `0 0 0 4px ${cfg.glow}` : "none",
                  }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12px", textTransform: "uppercase", color: cfg.color }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: "clamp(28px,3vw,44px)", fontWeight: 800, color: "#fff", marginTop: 6 }}>
                    {counts[status]}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {status === "all" && "établissements total"}
                    {status === "pending" && "en attente de décision"}
                    {status === "approved" && "en attente d'activation"}
                    {status === "active" && "écoles opérationnelles"}
                    {status === "rejected" && "demandes refusées"}
                    {status === "suspended" && "écoles suspendues"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recherche */}
          <div style={{ marginBottom: 16, position: "relative" }}>
            <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#475569", width: 18, height: 18 }} />
            <input
              type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par école, email, subdomain..."
              style={{ width: "100%", height: 48, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "0 16px 0 42px", fontSize: 14, color: "#e2e8f0", outline: "none", boxSizing: "border-box" }}
              onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
              onBlur={(e) => { e.target.style.borderColor = "#1e293b"; }}
            />
          </div>

          {/* Table */}
          <div style={{ background: "#101828", border: "1px solid #1a2840", borderRadius: 12, overflow: "hidden" }}>

            {/* Header table */}
            <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #0f1825" }}>
              <span style={{ color: "#4b6070", fontSize: 12 }}>
                Filtre actif :{" "}
                <span style={{ background: filterConfig[activeFilter].badgeBg, color: "white", padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800 }}>
                  {filterConfig[activeFilter].label.toUpperCase()}
                </span>
              </span>
              <span style={{ color: "#2d3f55", fontSize: 11 }}>{filteredSchools.length} résultat(s)</span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0d1225" }}>
                <tr>
                  {["Établissement", "Statut", "Template", "Plan", "Admin", "Lien invitation", "Actions"].map((h) => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .1, color: "#475569", padding: "12px 20px", textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#4b6070", padding: 48 }}>Chargement...</td></tr>
                ) : filteredSchools.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#4b6070", padding: 48 }}>Aucun résultat pour ce filtre.</td></tr>
                ) : filteredSchools.map((school) => {
                  const rawStatus = school.onboardingStatus === "active" && !school.isActive
                    ? "suspended"
                    : school.onboardingStatus;
                  const status = (rawStatus in filterConfig ? rawStatus : "all") as FilterStatus;
                  const cfg = filterConfig[status];
                  const plan = school.latestInvite?.metadata?.plan;
                  const planStyle = getPlanStyle(plan);
                  const inviteToken = school.latestInvite?.token;
                  const inviteExpired = school.latestInvite ? new Date(school.latestInvite.expiresAt) < new Date() : false;

                  return (
                    <tr key={school._id} style={{ borderBottom: "1px solid #0f1825" }}>

                      {/* Établissement */}
                      <td style={{ padding: "18px 20px" }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{school.schoolName}</div>
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{school.dbName}</div>
                      </td>

                      {/* Statut */}
                      <td style={{ padding: "18px 20px" }}>
                        <span style={{ background: "rgba(0,0,0,.3)", color: cfg.color, border: `1px solid ${cfg.activeBorder}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                          {cfg.label}
                        </span>
                      </td>

                      {/* Template */}
                      <td style={{ padding: "18px 20px" }}>
                        <span style={{ background: "#0f1e38", color: "#7dd3fc", border: "1px solid #1e3a6e", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
                          {school.templateKey || school.systemType || "—"}
                        </span>
                      </td>

                      {/* Plan */}
                      <td style={{ padding: "18px 20px" }}>
                        <span style={{ background: planStyle.bg, color: planStyle.color, border: `1px solid ${planStyle.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
                          {plan || "standard"}
                        </span>
                      </td>

                      {/* Admin */}
                      <td style={{ padding: "18px 20px" }}>
                        <div style={{ color: "#94a3b8", fontSize: 13 }}>{school.requestedAdminName || "—"}</div>
                        <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>{school.requestedAdminEmail || "—"}</div>
                      </td>

                      {/* Lien invitation */}
                      <td style={{ padding: "18px 20px" }}>
                        {inviteToken ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={() => copyInviteLink(inviteToken)}
                              style={{ background: "transparent", border: "1px solid #1a2840", color: inviteExpired ? "#475569" : "#7dd3fc", borderRadius: 6, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                              <Copy size={11} />
                              Copier
                            </button>
                            <button onClick={() => window.open(`${window.location.origin}/onboarding/join/${inviteToken}`, "_blank")}
                              style={{ background: "transparent", border: "1px solid #1a2840", color: "#475569", borderRadius: 6, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                              <ExternalLink size={11} />
                            </button>
                            {inviteExpired && <span style={{ color: "#f87171", fontSize: 10, fontWeight: 700 }}>EXPIRÉ</span>}
                          </div>
                        ) : (
                          <span style={{ color: "#334155", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>

                          {/* PENDING → Approuver + Rejeter */}
                          {school.onboardingStatus === "pending" && (
                            <>
                              <button onClick={() => openAction("approve", school._id)}
                                style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                Approuver
                              </button>
                              <button onClick={() => openAction("reject", school._id)}
                                style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                Rejeter
                              </button>
                            </>
                          )}

                          {/* DRAFT → Approuver */}
                          {school.onboardingStatus === "draft" && (
                            <button onClick={() => openAction("approve", school._id)}
                              style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                              Valider →
                            </button>
                          )}

                          {/* APPROVED → Relancer invitation */}
                          {school.onboardingStatus === "approved" && (
                            <button onClick={() => openAction("relaunch", school._id)}
                              style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                              Relancer invitation
                            </button>
                          )}

                          {/* REJECTED → Réexaminer (reactivate) */}
                          {school.onboardingStatus === "rejected" && (
                            <button onClick={() => openAction("reactivate", school._id)}
                              style={{ background: "#d97706", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                              Réexaminer
                            </button>
                          )}

                          {/* ACTIVE → Gérer + Suspendre */}
                          {school.onboardingStatus === "active" && school.isActive && (
                            <>
                              <button onClick={() => openAction("manage", school._id)}
                                style={{ background: "#0d7a56", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                Gérer →
                              </button>
                              <button onClick={() => openAction("suspend", school._id)}
                                style={{ background: "transparent", color: "#f87171", border: "1px solid rgba(239,68,68,.4)", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                Suspendre
                              </button>
                            </>
                          )}

                          {/* SUSPENDED → Réactiver */}
                          {school.onboardingStatus === "active" && !school.isActive && (
                            <button onClick={() => openAction("reactivate", school._id)}
                              style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                              Réactiver
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ padding: "10px 20px", borderTop: "1px solid #0f1825" }}>
              <span style={{ fontSize: 12, color: "#334155", fontStyle: "italic" }}>
                EduNexus Hub de Contrôle · {new Date().getFullYear()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} onSuccess={fetchSchools} />
      )}

      {sensitiveDialog && (
        <SensitiveDialog
          title={sensitiveDialog.label}
          onConfirm={confirmAction}
          onCancel={() => setSensitiveDialog(null)}
          loading={sensitiveLoading}
        />
      )}
    </div>
  );
};

export default DashboardSuperAdmin;