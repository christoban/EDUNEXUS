import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Loader2, ShieldCheck, Sparkles, Layers3, Lock } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const MasterLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<"credentials" | "email" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [manualEntryKey, setManualEntryKey] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await api.get("/master/auth/me");
        navigate("/master/onboarding/requests", { replace: true });
      } catch {
        // Stay on login form when no master session exists.
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      const { data } = await api.post("/master/auth/login", { email, password });

      if (data?.requiresEmailVerification) {
        setStage("email");
        setEmailCode("");
        setMfaCode("");
        setMfaSetupRequired(false);
        setQrCodeDataUrl(null);
        setManualEntryKey(null);
        setRecoveryCodes(null);
        toast.success("Code envoyé par email. Vérifie ta boîte de réception.");
        return;
      }

      toast.success("Connexion master réussie.");
      navigate("/master/onboarding/requests", { replace: true });
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || "Impossible de se connecter au portail master.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyEmailCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      const { data } = await api.post("/master/auth/verify-email-code", { code: emailCode });

      if (data?.requiresMfa) {
        setStage("mfa");
        setMfaSetupRequired(Boolean(data?.mfaSetupRequired));
        setQrCodeDataUrl(data?.qrCodeDataUrl || null);
        setManualEntryKey(data?.manualEntryKey || null);
        setRecoveryCodes(Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : null);
        setMfaCode("");
        toast.success(data?.mfaSetupRequired ? "Scanne le QR code dans Authenticator puis saisis le code." : "Saisis le code de ton application Authenticator.");
        return;
      }

      toast.success("Validation email réussie.");
      navigate("/master/onboarding/requests", { replace: true });
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || "Code email invalide.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyMfa = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      await api.post("/master/auth/verify-mfa", { code: mfaCode.trim() });
      toast.success("Connexion master sécurisée réussie.");
      navigate("/master/onboarding/requests", { replace: true });
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || "Code MFA invalide.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white md:px-8 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_26%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:56px_56px]" />

      <main className="relative z-10 mx-auto grid min-h-screen max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="flex h-full flex-col justify-between gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-10">
          <div className="space-y-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-100">
              <Sparkles className="h-4 w-4" />
              Portail plateforme EDUNEXUS
            </div>
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white md:text-6xl">
              Supervise les établissements depuis une console unique.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Revue des demandes, approbation des tenants et pilotage de la couche master, avec séparation stricte des sessions et des données.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <Layers3 className="mb-3 h-5 w-5 text-sky-300" />
              <p className="text-sm text-slate-300">Master DB centralisée</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" />
              <p className="text-sm text-slate-300">Validation des demandes d'onboarding</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <Lock className="mb-3 h-5 w-5 text-violet-300" />
              <p className="text-sm text-slate-300">Session master séparée</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-semibold text-white">Workflow</p>
              <p className="mt-1 leading-6">draft → pending → approved → provisioning → active</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-semibold text-white">Accès</p>
              <p className="mt-1 leading-6">Connexion plateforme séparée du login établissement.</p>
            </div>
          </div>
        </section>

        <Card className="w-full border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-3 border-b border-white/10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-100">
              <ShieldCheck className="h-4 w-4" />
              Portail master
            </div>
            <CardTitle className="text-2xl">Connexion plateforme</CardTitle>
            <CardDescription className="text-slate-400">
              Accède à la revue des demandes d'établissement et aux outils d'administration globale.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                Vérification de la session master...
              </div>
            ) : stage === "credentials" ? (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    placeholder="admin@edunexus.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Mot de passe</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full bg-sky-400 text-black hover:bg-sky-300"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connexion...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Se connecter
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
                {error && <p className="text-sm text-red-200">{error}</p>}
              </form>
            ) : stage === "email" ? (
              <form className="space-y-4" onSubmit={verifyEmailCode}>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-white">Validation email requise</p>
                  <p className="mt-2 leading-6">
                    Nous avons envoyé un code à 6 chiffres à {email}. Entre ce code pour continuer vers la vérification Authenticator.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Code email (6 chiffres)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    placeholder="123456"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-sky-400 text-black hover:bg-sky-300"
                  disabled={submitting || emailCode.length !== 6}
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Vérification...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Valider le code email
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-white/10 bg-transparent text-white hover:bg-white/10"
                  onClick={() => {
                    setStage("credentials");
                    setEmailCode("");
                    setMfaCode("");
                    setMfaSetupRequired(false);
                    setQrCodeDataUrl(null);
                    setManualEntryKey(null);
                    setRecoveryCodes(null);
                    setError("");
                  }}
                >
                  Revenir a l'etape login
                </Button>

                {error && <p className="text-sm text-red-200">{error}</p>}
              </form>
            ) : (
              <form className="space-y-4" onSubmit={verifyMfa}>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-white">
                    {mfaSetupRequired ? "Configuration MFA requise" : "Validation MFA requise"}
                  </p>
                  <p className="mt-2 leading-6">
                    {mfaSetupRequired
                      ? "Scanne le QR code avec ton application Authenticator, puis garde précieusement tes codes de secours affichés ci-dessous."
                      : "Entre le code de ton application Authenticator ou un code de secours à usage unique."}
                  </p>
                </div>

                {mfaSetupRequired && qrCodeDataUrl && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR code MFA"
                      className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
                    />
                    {manualEntryKey && (
                      <p className="text-xs leading-6 text-slate-300 break-all">
                        Cle manuelle: <span className="font-mono text-slate-100">{manualEntryKey}</span>
                      </p>
                    )}
                    {recoveryCodes && recoveryCodes.length > 0 && (
                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4">
                        <p className="text-sm font-semibold text-amber-100">Codes de secours</p>
                        <p className="mt-1 text-xs leading-6 text-amber-50/90">
                          Sauvegarde-les maintenant. Chaque code ne peut être utilisé qu'une seule fois.
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {recoveryCodes.map((code) => (
                            <div key={code} className="rounded-lg border border-amber-300/20 bg-black/20 px-3 py-2 font-mono text-sm tracking-[0.2em] text-white">
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Code MFA ou code de secours</label>
                  <Input
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    maxLength={32}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32))}
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    placeholder="123456 ou ABCD-EFGH-IJKL-MNOP"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-sky-400 text-black hover:bg-sky-300"
                  disabled={submitting || mfaCode.trim().length < 6}
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verification...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Valider le code
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-white/10 bg-transparent text-white hover:bg-white/10"
                  onClick={() => {
                    setStage("credentials");
                    setMfaCode("");
                    setMfaSetupRequired(false);
                    setQrCodeDataUrl(null);
                    setManualEntryKey(null);
                    setRecoveryCodes(null);
                    setError("");
                  }}
                >
                  Revenir a l'etape mot de passe
                </Button>

                {error && <p className="text-sm text-red-200">{error}</p>}
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MasterLogin;
