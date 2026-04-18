import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Building2, Copy, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { MASTER_LOGIN_PATH } from "@/lib/masterRoutes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  MasterSchoolActivityLogsResponse,
  MasterSchoolDetail,
  MasterSchoolInviteEmailStatus,
  SchoolOnboardingRequestSummary,
  SchoolOnboardingStatus,
} from "@/types";

const statusTone: Record<SchoolOnboardingStatus, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  approved: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  provisioning: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  rejected: "border-red-400/30 bg-red-400/10 text-red-100",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const MasterSchoolDetail = () => {
  const navigate = useNavigate();
  const { schoolId } = useParams<{ schoolId: string }>();
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<MasterSchoolDetail | null>(null);
  const [requestSummary, setRequestSummary] = useState<SchoolOnboardingRequestSummary | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [activityLogs, setActivityLogs] = useState<MasterSchoolActivityLogsResponse | null>(null);
  const [inviteEmailStatus, setInviteEmailStatus] = useState<MasterSchoolInviteEmailStatus | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [suspensionReason, setSuspensionReason] = useState("");

  const onboardingStatus = school?.onboardingStatus || "draft";

  useEffect(() => {
    const loadSchool = async () => {
      if (!schoolId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [schoolResult, requestsResult, configResult, activityResult, inviteEmailResult] = await Promise.allSettled([
          api.get<MasterSchoolDetail>(`/master/schools/${schoolId}`),
          api.get<{ requests: SchoolOnboardingRequestSummary[] }>("/onboarding/requests?limit=100&page=1"),
          api.get(`/master/schools/${schoolId}/config`),
          api.get<MasterSchoolActivityLogsResponse>(`/master/schools/${schoolId}/activity-logs?limit=8&page=1`),
          api.get<{ lastEmail: MasterSchoolInviteEmailStatus | null }>(`/master/schools/${schoolId}/invite/email-status`),
        ]);

        if (schoolResult.status === "fulfilled") {
          setSchool(schoolResult.value.data);
        } else {
          throw schoolResult.reason;
        }

        if (requestsResult.status === "fulfilled") {
          const matchedRequest = requestsResult.value.data.requests.find((request) => request._id === schoolId) || null;
          setRequestSummary(matchedRequest);
        }

        if (configResult.status === "fulfilled") {
          setConfig(configResult.value.data || null);
        }

        if (activityResult.status === "fulfilled") {
          setActivityLogs(activityResult.value.data || null);
        }

        if (inviteEmailResult.status === "fulfilled") {
          setInviteEmailStatus(inviteEmailResult.value.data?.lastEmail || null);
        }
      } catch (error: any) {
        const message = error?.response?.data?.message || "Impossible de charger la fiche établissement.";
        toast.error(message);
        navigate("/master/schools", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadSchool();
  }, [schoolId, navigate, reloadTick]);

  const copyDbName = async () => {
    if (!school?.dbName) return;
    await navigator.clipboard.writeText(school.dbName);
    toast.success("Nom de base copié.");
  };

  const copyDbConnectionString = async () => {
    if (!school?.dbConnectionString) return;
    await navigator.clipboard.writeText(school.dbConnectionString);
    toast.success("Chaîne de connexion copiée.");
  };

  const openRequests = () => {
    navigate("/master/onboarding/requests");
  };

  const refreshSchool = () => {
    setReloadTick((value) => value + 1);
  };

  const runAction = async (action: string, endpoint: string, confirmation: string, payload?: Record<string, unknown>) => {
    if (!schoolId) return;

    if (!window.confirm(confirmation)) {
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
      setActionLoading(action);
      const { data } = await api.post(endpoint, {
        ...(payload || {}),
        sensitiveAuth: {
          password,
          code,
        },
      });

      if (action === "regenerate-invite" && data?.invite) {
        setRequestSummary((current) =>
          current
            ? {
                ...current,
                onboardingStatus: data.school?.onboardingStatus || current.onboardingStatus,
                latestInvite: {
                  token: data.invite.token,
                  status: data.invite.status,
                  expiresAt: data.invite.expiresAt,
                  acceptedAt: null,
                  requestedAdminName: data.invite.requestedAdminName,
                  requestedAdminEmail: data.invite.requestedAdminEmail,
                  createdAt: new Date().toISOString(),
                },
              }
            : current
        );
        if (data.activationUrl) {
          await navigator.clipboard.writeText(data.activationUrl);
          toast.success("Lien d'invitation régénéré et copié.");
        } else {
          toast.success("Lien d'invitation régénéré.");
        }
      } else if (action === "resend-invite" && data?.activationUrl) {
        await navigator.clipboard.writeText(data.activationUrl);
        toast.success("Invitation renvoyée et lien copié.");
      } else {
        toast.success(data?.message || "Action réalisée.");
      }

      refreshSchool();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Action impossible.";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  const logout = async () => {
    try {
      await api.post("/master/auth/logout");
    } catch {
      // ignore
    } finally {
      navigate(MASTER_LOGIN_PATH, { replace: true });
    }
  };

  const schoolConfigEntries = useMemo(() => {
    if (!config || typeof config !== "object") return [];
    return Object.entries(config).filter(([key, value]) => key !== "_id" && value !== null && value !== undefined);
  }, [config]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit border-white/10 bg-sky-400/10 text-sky-100">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Fiche établissement
              </Badge>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                {school?.schoolName || "Établissement"}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Vue détaillée du tenant, des métadonnées et du statut d'onboarding.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={openRequests}>
                Revue onboarding
              </Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => navigate("/master/security")}>
                Sécurité MFA
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                onClick={() =>
                  runAction(
                    school?.isActive ? "suspend" : "reactivate",
                    school?.isActive ? `/master/schools/${schoolId}/suspend` : `/master/schools/${schoolId}/reactivate`,
                    school?.isActive
                      ? "Suspendre cette école bloque l'accès sans supprimer les données. Continuer ?"
                      : "Réactiver cette école va restaurer l'accès. Continuer ?",
                    school?.isActive ? { reason: suspensionReason.trim() || "Suspension master" } : undefined
                  )
                }
                disabled={actionLoading !== null}
              >
                {actionLoading === (school?.isActive ? "suspend" : "reactivate") ? "Patientez..." : school?.isActive ? "Suspendre" : "Réactiver"}
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                onClick={() => runAction(
                  "regenerate-invite",
                  `/master/schools/${schoolId}/invite/regenerate`,
                  "Régénérer le lien d'onboarding invalide l'ancien lien encore en attente. Continuer ?"
                )}
                disabled={actionLoading !== null}
              >
                {actionLoading === "regenerate-invite" ? "Patientez..." : "Régénérer l'invite"}
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                onClick={() => runAction(
                  "resend-invite",
                  `/master/schools/${schoolId}/invite/resend`,
                  "Renvoyer l'invitation email avec le lien actuel ?"
                )}
                disabled={actionLoading !== null}
              >
                {actionLoading === "resend-invite" ? "Patientez..." : "Renvoyer email"}
              </Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={logout}>
                Déconnexion
              </Button>
            </div>
          </div>
        </section>

        {loading ? (
          <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
            <CardContent className="flex items-center gap-3 px-6 py-10 text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement de la fiche établissement...
            </CardContent>
          </Card>
        ) : school ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Statut", value: onboardingStatus, tone: statusTone[onboardingStatus] },
                { label: "Type", value: `${school.systemType} · ${school.structure}`, tone: "border-white/10 bg-black/20 text-white" },
                { label: "Tenant", value: school.dbName, tone: "border-white/10 bg-black/20 text-white" },
                { label: "Pilot", value: school.isPilot ? "Oui" : "Non", tone: school.isPilot ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-black/20 text-slate-200" },
              ].map((item) => (
                <Card key={item.label} className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                    <div className="mt-3">
                      {item.label === "Statut" ? (
                        <Badge className={item.tone} variant="outline">
                          {item.value}
                        </Badge>
                      ) : (
                        <p className={`text-lg font-semibold ${item.tone.includes("text-") ? item.tone : "text-white"}`}>{item.value}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Identité & connexion</CardTitle>
                  <CardDescription className="text-slate-400">Tenant, connexion Mongo et coordonnées principales.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6 text-sm text-slate-200">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Motto</p>
                      <p className="mt-2 font-medium">{school.schoolMotto || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Base</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate font-medium">{school.dbName}</p>
                        <Button size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={copyDbName}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Connection string</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-mono text-xs text-slate-300">{school.dbConnectionString}</p>
                      <Button size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={copyDbConnectionString}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Contact</p>
                      <p className="mt-2 font-medium">{school.contactEmail || "-"}</p>
                      <p className="text-slate-400">{school.contactPhone || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Localisation</p>
                      <p className="mt-2 font-medium">{school.location || "-"}</p>
                      <p className="text-slate-400">Année fondation: {school.foundedYear || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Onboarding & audit</CardTitle>
                  <CardDescription className="text-slate-400">Dernière demande, template et statut d'activation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6 text-sm text-slate-200">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Template</p>
                      <p className="mt-2 font-medium">{school.templateKey || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Dernière mise à jour</p>
                      <p className="mt-2 font-medium">{formatDateTime(school.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Admin demandé</p>
                    <p className="mt-2 font-medium">{school.requestedAdminName || "-"}</p>
                    <p className="text-slate-400">{school.requestedAdminEmail || "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Complexe parent</p>
                    <p className="mt-2 font-medium">{school.parentComplex?.complexName || "-"}</p>
                  </div>

                  {requestSummary && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Dernier lien d'invitation</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Statut</span>
                          <Badge className={statusTone[requestSummary.onboardingStatus]} variant="outline">
                            {requestSummary.onboardingStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Créée le</span>
                          <span className="text-slate-100">{formatDateTime(requestSummary.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Invitation</span>
                          <span className="text-slate-100">{requestSummary.latestInvite?.status || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Expire le</span>
                          <span className="text-slate-100">{formatDateTime(requestSummary.latestInvite?.expiresAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-300">Dernier envoi email</span>
                          {inviteEmailStatus ? (
                            <span className="flex items-center gap-2 text-slate-100">
                              <Badge
                                variant="outline"
                                className={inviteEmailStatus.status === "sent"
                                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                                  : "border-red-400/30 bg-red-400/10 text-red-100"}
                              >
                                {inviteEmailStatus.status}
                              </Badge>
                              <span>{formatDateTime(inviteEmailStatus.sentAt)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-100">-</span>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/10 bg-transparent text-white hover:bg-white/10"
                            onClick={() => {
                              const params = new URLSearchParams();
                              params.set("eventType", "school_invite");
                              if (schoolId) params.set("schoolId", schoolId);
                              if (school?.requestedAdminEmail) params.set("search", school.requestedAdminEmail);
                              navigate(`/master/email-history?${params.toString()}`);
                            }}
                          >
                            Voir le log email complet
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {school?.isActive && (
              <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
                <CardHeader className="border-b border-white/10">
                  <CardTitle>Motif de suspension</CardTitle>
                  <CardDescription className="text-slate-400">
                    Renseigne un motif avant suspension. Le motif part dans l'audit.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none placeholder:text-slate-500"
                    placeholder="Ex: incident de facturation, migration planifiée, sécurité, etc."
                    value={suspensionReason}
                    onChange={(event) => setSuspensionReason(event.target.value)}
                  />
                </CardContent>
              </Card>
            )}

            <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <CardTitle>Configuration master</CardTitle>
                <CardDescription className="text-slate-400">
                  Configuration centralisée récupérée depuis la base master.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {schoolConfigEntries.length === 0 ? (
                  <div className="text-sm text-slate-300">Aucune configuration disponible.</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {schoolConfigEntries.map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{key}</p>
                        <p className="mt-2 break-words text-sm text-slate-100">{typeof value === "object" ? JSON.stringify(value) : String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <CardTitle>Historique des actions</CardTitle>
                <CardDescription className="text-slate-400">
                  Dernières actions master sur cet établissement.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {!activityLogs?.logs?.length ? (
                  <div className="text-sm text-slate-300">Aucune action enregistrée pour le moment.</div>
                ) : (
                  <div className="space-y-3">
                    {activityLogs.logs.map((log) => (
                      <div key={log._id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{log.action}</p>
                          <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-300">{log.details || "-"}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {typeof log.user === "string" ? log.user : `${log.user.name || log.user.email || "User"} · ${log.user.role || "-"}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default MasterSchoolDetail;
