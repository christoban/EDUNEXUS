import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle2, Loader2, School, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SchoolInviteSummary } from "@/types";

const SchoolInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<SchoolInviteSummary | null>(null);
  const [school, setSchool] = useState<any>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const loadInvite = async () => {
      if (!token) {
        setError("Lien invalide.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data } = await api.get(`/onboarding/join/${token}`);
        setInvite(data?.invite || null);
        setSchool(data?.school || null);
        setAdminName(data?.invite?.requestedAdminName || "");
        setAdminEmail(data?.invite?.requestedAdminEmail || "");
      } catch (requestError: any) {
        const message = requestError?.response?.data?.message || "Impossible de charger le lien d'invitation.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  const activateSchool = async () => {
    if (!token) return;

    if (!adminName.trim() || !adminEmail.trim()) {
      toast.error("Le nom et l'email admin sont requis.");
      return;
    }

    if (adminPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (adminPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/onboarding/join/${token}`, {
        adminName,
        adminEmail,
        adminPassword,
      });
      setDone(true);
      toast.success("L'espace établissement est maintenant activé.");
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || "Impossible d'activer l'établissement.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.16),_transparent_28%)]" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-10">
        <Card className="w-full border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-2 border-b border-white/10">
            <CardTitle className="text-2xl">Activation de l'établissement</CardTitle>
            <CardDescription className="text-slate-300">
              Vérifie les informations et active l'espace temporaire.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement de l'invitation...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
                {error}
                <div className="mt-4">
                  <Button variant="outline" className="border-white/10 bg-transparent text-white" onClick={() => navigate("/")}>
                    Retour à l'accueil
                  </Button>
                </div>
              </div>
            ) : done ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-50">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6" />
                  <p className="font-semibold">Établissement activé avec succès.</p>
                </div>
                <p className="mt-3 text-sm text-emerald-50/90">
                  Tu peux maintenant finaliser la configuration dans la partie master ou ouvrir la suite d'administration de l'espace.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => navigate("/login")} className="bg-white text-black hover:bg-slate-100">
                    Aller à la connexion
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <ShieldCheck className="h-5 w-5" />
                      <span className="text-sm font-semibold uppercase tracking-[0.2em]">Lien temporaire</span>
                    </div>
                    <h2 className="text-3xl font-bold">{school?.schoolName || "Établissement"}</h2>
                    <p className="text-slate-300">{school?.schoolMotto}</p>
                    <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <div>Admin demandé: <span className="text-white">{invite?.requestedAdminName}</span></div>
                      <div>Email: <span className="text-white">{invite?.requestedAdminEmail}</span></div>
                      <div>Statut: <span className="text-white">{invite?.status}</span></div>
                      <div>Expire le: <span className="text-white">{invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "-"}</span></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <School className="mx-auto h-10 w-10 text-emerald-300" />
                    <p className="mt-3 text-sm text-slate-300">Ce lien active l'espace établissement.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Le système prépare le tenant, applique le template initial et bascule l'établissement en mode actif.
                </div>

                <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-200">Nom administrateur</label>
                    <Input
                      value={adminName}
                      onChange={(event) => setAdminName(event.target.value)}
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      placeholder="Nom complet"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-200">Email administrateur</label>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(event) => setAdminEmail(event.target.value)}
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      placeholder="admin@ecole.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Mot de passe</label>
                    <Input
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      placeholder="******"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Confirmer le mot de passe</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      placeholder="******"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={activateSchool}
                  disabled={submitting}
                  className="h-12 w-full rounded-xl bg-emerald-400 text-black hover:bg-emerald-300"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Activation...
                    </span>
                  ) : (
                    "Activer l'établissement"
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SchoolInvite;
