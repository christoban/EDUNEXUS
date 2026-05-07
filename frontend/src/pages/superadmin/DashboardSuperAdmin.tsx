import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Search } from "lucide-react";
import SuperAdminNavbar from "@/components/sidebar/SuperAdminNavbar";
import InviteModal from "./InviteModal";

const SchoolDetailPageLazy = lazy(() => import("./SchoolDetailPage").then(m => ({ default: m.default })));

type FilterStatus = "pending" | "rejected" | "approved" | "active" | "suspended";

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
  latestInvite: {
    token: string;
    status: string;
    expiresAt: string;
    requestedAdminEmail: string;
    requestedAdminName: string;
    metadata?: {
      plan?: string;
    };
  } | null;
};

const DashboardSuperAdmin: React.FC = () => {

  const [activeFilter, setActiveFilter] = useState<FilterStatus>("active");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activePage, setActivePage] = useState<"hub" | "detail">("hub");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/master/schools");
      setSchools(response.data.schools);
    } catch {
      toast.error("Erreur lors du chargement des écoles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const counts = useMemo(
    () => ({
      pending: schools.filter((s) => s.onboardingStatus === "pending").length,
      rejected: schools.filter((s) => s.onboardingStatus === "rejected").length,
      approved: schools.filter((s) => s.onboardingStatus === "approved").length,
      suspended: schools.filter(
        (s) => s.onboardingStatus === "active" && !s.isActive
      ).length,
      active: schools.filter(
        (s) => s.onboardingStatus === "active" && s.isActive
      ).length,
    }),
    [schools]
  );

  const filteredSchools = useMemo(() => {
    let filtered = schools;
    if (activeFilter === "active") {
      filtered = filtered.filter(
        (s) => s.onboardingStatus === "active" && s.isActive
      );
    } else if (activeFilter === "suspended") {
      filtered = filtered.filter(
        (s) => s.onboardingStatus === "active" && !s.isActive
      );
    } else {
      filtered = filtered.filter((s) => s.onboardingStatus === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.schoolName.toLowerCase().includes(query) ||
          (s.requestedAdminEmail && s.requestedAdminEmail.toLowerCase().includes(query)) ||
          (s.requestedAdminName && s.requestedAdminName.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [schools, activeFilter, searchQuery]);

  const handleAction = async (
    schoolId: string,
    action: "approve" | "reject" | "reexamine" | "relaunch" | "manage" | "reactivate"
  ) => {
    if (action === "manage") {
      const school = schools.find((s) => s._id === schoolId);
      if (school) {
        setSelectedSchool(school);
        setActivePage("detail");
      }
      return;
    }

    const password = window.prompt("Confirme ton mot de passe master pour cette action sensible:") || "";
    if (!password.trim()) {
      toast.error("Mot de passe requis.");
      return;
    }

    const code = window.prompt("Entre ton code MFA (6 chiffres) ou un recovery code:") || "";
    if (!code.trim()) {
      toast.error("Code MFA/recovery requis.");
      return;
    }

    try {
      if (action === "approve") {
        await api.post(`/onboarding/requests/${schoolId}/approve`, {
          sensitiveAuth: { password, code },
        });
        toast.success("Demande approuvée.");
      } else if (action === "reject") {
        await api.post(`/onboarding/requests/${schoolId}/reject`, {
          sensitiveAuth: { password, code },
        });
        toast.success("Demande rejetée.");
      } else if (action === "reexamine") {
        await api.post(`/master/schools/${schoolId}/reactivate`, {
          sensitiveAuth: { password, code },
        });
        toast.success("Demande réexaminée.");
      } else if (action === "relaunch") {
        await api.post(`/master/schools/${schoolId}/invite/resend`, {
          sensitiveAuth: { password, code },
        });
        toast.success("Invitation relancée.");
      } else if (action === "reactivate") {
        await api.post(`/master/schools/${schoolId}/reactivate`, {
          sensitiveAuth: { password, code },
        });
        toast.success("École réactivée.");
      }
      fetchSchools();
    } catch (error: any) {
      // Log complet pour debug
      console.error("[APPROUVE ERROR]", error, error?.response?.data);
      const message = error?.response?.data?.message || "Action impossible.";
      toast.error(message);
    }
  };

  const handleInviteSuccess = () => {
    fetchSchools();
  };

  const statusColors: Record<FilterStatus, { label: string; bgCard: string; borderNormal: string; borderActive: string; glow: string; badgeBg: string; text: string }> = {
    pending: { label: "#fb923c", bgCard: "#160f04", borderNormal: "#92400e", borderActive: "#f97316", glow: "rgba(249,115,22,.15)", badgeBg: "#7c2d12", text: "#fb923c" },
    rejected: { label: "#f87171", bgCard: "#160404", borderNormal: "#991b1b", borderActive: "#ef4444", glow: "rgba(239,68,68,.15)", badgeBg: "#7f1d1d", text: "#f87171" },
    approved: { label: "#60a5fa", bgCard: "#04091a", borderNormal: "#1e3a6e", borderActive: "#3b82f6", glow: "rgba(59,130,246,.15)", badgeBg: "#1e3a8a", text: "#60a5fa" },
    active: { label: "#4ade80", bgCard: "#041208", borderNormal: "#166534", borderActive: "#22c55e", glow: "rgba(34,197,94,.15)", badgeBg: "#14532d", text: "#4ade80" },
    suspended: { label: "#fca5a5", bgCard: "#1a0505", borderNormal: "#7f1d1d", borderActive: "#ef4444", glow: "rgba(239,68,68,.15)", badgeBg: "#450a0a", text: "#fca5a5" },
  };

  const getPlanStyle = (plan: string | undefined) => {
    if (plan === "premium") {
      return { bg: "#052e16", color: "#86efac", border: "#166534" };
    }
    if (plan === "standard") {
      return { bg: "#271900", color: "#fcd34d", border: "#451a03" };
    }
    return { bg: "#1a0505", color: "#fca5a5", border: "#7f1d1d" };
  };

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

  return (
    <div>
      <SuperAdminNavbar onInviteClick={() => setShowInviteModal(true)} />

      <div
        style={{
          background: "#080c18",
          minHeight: "calc(100vh - 64px)",
          padding: "clamp(40px,5vh,64px) clamp(32px,5vw,80px)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}>
          <h1 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 6 }}>Hub de Contrôle</h1>
          <p style={{ fontSize: 15, color: "#64748b" }}>
            Gestion centralisée des établissements camerounais
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 14,
              marginBottom: 20,
            }}
          >
            {(["pending", "rejected", "approved", "active", "suspended"] as FilterStatus[]).map((status) => {
              const colors = statusColors[status];
              const isSelected = activeFilter === status;
              return (
                <div
                  key={status}
                  onClick={() => setActiveFilter(status)}
                  style={{
                    minHeight: "auto",
                    padding: "20px 24px",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    border: isSelected ? `2px solid ${colors.borderActive}` : `2px solid ${colors.borderNormal}`,
                    background: colors.bgCard,
                    boxShadow: isSelected ? `0 0 0 4px ${colors.glow}` : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 0.12,
                      textTransform: "uppercase",
                      color: colors.text,
                    }}
                  >
                    {status}
                  </div>
                  <div style={{ fontSize: "clamp(36px,4vw,52px)", fontWeight: 800, color: "#fff", marginTop: 8 }}>
                    {counts[status]}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    {status === "pending" && "en attente de décision"}
                    {status === "rejected" && "demandes refusées"}
                    {status === "approved" && "en attente d'activation"}
                    {status === "active" && "écoles opérationnelles"}
                    {status === "suspended" && "écoles suspendues"}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: 16, position: "relative" }}>
            <Search
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "#475569",
                width: 18,
                height: 18,
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par école, email, administrateur..."
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.background = "#111827";
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#1e293b";
                e.currentTarget.style.background = "#0f172a";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.outline = "none";
              }}
              style={{
                width: "100%",
                height: 48,
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 10,
                padding: "0 16px 0 42px",
                fontSize: 14,
                color: "#e2e8f0",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            style={{
              background: "#101828",
              border: "1px solid #1a2840",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #0f1825",
              }}
            >
              <span style={{ color: "#4b6070", fontSize: 12 }}>
                Vue filtrée — Filtre :{" "}
                <span
                  style={{
                    background: statusColors[activeFilter].badgeBg,
                    color: "white",
                    padding: "2px 10px",
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 800,
                    marginLeft: 6,
                  }}
                >
                  {activeFilter.toUpperCase()}
                </span>
              </span>
              <span style={{ color: "#2d3f55", fontSize: 11 }}>
                {filteredSchools.length} résultat(s)
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0d1225" }}>
                <tr>
                  <th style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.1, color: "#475569", padding: "12px 20px", textAlign: "left" }}>ÉTABLISSEMENT</th>
                  <th style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.1, color: "#475569", padding: "12px 20px", textAlign: "left" }}>TYPE</th>
                  <th style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.1, color: "#475569", padding: "12px 20px", textAlign: "left" }}>PLAN</th>
                  <th style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.1, color: "#475569", padding: "12px 20px", textAlign: "left" }}>UTILISATEURS</th>
                  <th style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.1, color: "#475569", padding: "12px 20px", textAlign: "left" }}>DERNIÈRE CONNEXION</th>
                  <th style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.1, color: "#475569", padding: "12px 20px", textAlign: "left" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#4b6070", padding: 40 }}>
                      Chargement...
                    </td>
                  </tr>
                ) : filteredSchools.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#4b6070", padding: 40 }}>
                      Aucun résultat
                    </td>
                  </tr>
                ) : (
                  filteredSchools.map((school) => (
                    <tr
                      key={school._id}
                      style={{ borderBottom: "1px solid #0f1825" }}
                    >
                      <td style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>
                            {school.schoolName}
                          </span>
                          {!school.isActive && (
                            <span
                              style={{
                                background: "#1a0505",
                                color: "#fca5a5",
                                border: "1px solid #7f1d1d",
                                borderRadius: 4,
                                padding: "2px 8px",
                                fontSize: 9,
                                fontWeight: 800,
                              }}
                            >
                              INACTIF
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                          {school.requestedAdminEmail || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "18px 20px" }}>
                        <span
                          style={{
                            background: "#0f1e38",
                            color: "#7dd3fc",
                            border: "1px solid #1e3a6e",
                            borderRadius: 6,
                            padding: "4px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {school.templateKey || school.systemType}
                        </span>
                      </td>
                      <td style={{ padding: "18px 20px" }}>
                        {(() => {
                          const plan = school.latestInvite?.metadata?.plan || "standard";
                          const style = getPlanStyle(plan);
                          return (
                            <span
                              style={{
                                background: style.bg,
                                color: style.color,
                                border: `1px solid ${style.border}`,
                                borderRadius: 6,
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {plan}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "18px 20px", color: "#64748b", textAlign: "center" }}>
                        —
                      </td>
                      <td style={{ padding: "18px 20px", fontSize: 15, color: "#64748b" }}>
                        {new Date(school.updatedAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          {activeFilter === "pending" && (
                          <>
                              <button
                                onClick={() => handleAction(school._id, "approve")}
                                style={{
                                  background: "#16a34a",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 7,
                                  padding: "10px 20px",
                                  fontSize: 14,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Approuver
                              </button>
                              <button
                                onClick={() => handleAction(school._id, "reject")}
                                style={{
                                  background: "#dc2626",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 7,
                                  padding: "10px 20px",
                                  fontSize: 14,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Rejeter
                              </button>
                          </>
                          )}
                          {activeFilter === "rejected" && (
                            <button
                              onClick={() => handleAction(school._id, "reexamine")}
                              style={{
                                background: "#d97706",
                                color: "white",
                                border: "none",
                                borderRadius: 7,
                                padding: "10px 20px",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Réexaminer
                            </button>
                          )}
                          {activeFilter === "approved" && (
                            <button
                              onClick={() => handleAction(school._id, "relaunch")}
                              style={{
                                background: "#2563eb",
                                color: "white",
                                border: "none",
                                borderRadius: 7,
                                padding: "10px 20px",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Relancer l'invitation
                            </button>
                          )}
                          {activeFilter === "active" && (
                            <button
                              onClick={() => handleAction(school._id, "manage")}
                              style={{
                                background: "#0d7a56",
                                color: "white",
                                border: "none",
                                borderRadius: 7,
                                padding: "10px 20px",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Gérer l'établissement →
                            </button>
                          )}
                          {activeFilter === "suspended" && (
                            <button
                              onClick={() => handleAction(school._id, "reactivate")}
                              style={{
                                background: "#16a34a",
                                color: "white",
                                border: "none",
                                borderRadius: 7,
                                padding: "10px 20px",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Réactiver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div
              style={{
                padding: "10px 20px",
                borderTop: "1px solid #0f1825",
              }}
            >
              <span style={{ fontSize: 12, color: "#334155", marginTop: 4, fontStyle: "italic" }}>
                Dernier accès : Master Admin
              </span>
            </div>
          </div>
        </div>
      </div>

      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} onSuccess={handleInviteSuccess} />
      )}
    </div>
  );
};

export default DashboardSuperAdmin;