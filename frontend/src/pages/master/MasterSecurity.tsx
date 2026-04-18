import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, KeyRound, Loader2, LockKeyhole, RefreshCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { MASTER_LOGIN_PATH } from "@/lib/masterRoutes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type MfaStatusResponse = {
  mfaEnabled: boolean;
  hasPendingMfaSetup: boolean;
  recoveryCodesRemaining: number;
  recoveryCodesGeneratedAt: string | null;
  email: string;
};

type MfaSetupResponse = {
  qrCodeDataUrl: string;
  manualEntryKey: string;
  recoveryCodes: string[];
};

type PasswordChangeStartResponse = {
  requiresEmailVerification: boolean;
  message: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const MasterSecurity = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  const [verificationPassword, setVerificationPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [passwordFlowCurrentPassword, setPasswordFlowCurrentPassword] = useState("");
  const [passwordFlowMfaOrRecoveryCode, setPasswordFlowMfaOrRecoveryCode] = useState("");
  const [passwordFlowEmailCode, setPasswordFlowEmailCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChangeEmailStep, setPasswordChangeEmailStep] = useState(false);
  const [enableCode, setEnableCode] = useState("");
  const [setupPayload, setSetupPayload] = useState<MfaSetupResponse | null>(null);
  const [latestRecoveryCodes, setLatestRecoveryCodes] = useState<string[] | null>(null);

  const mfaIsEnabled = Boolean(status?.mfaEnabled);

  const fetchStatus = async () => {
    try {
      const { data } = await api.get<MfaStatusResponse>("/master/auth/mfa-status");
      setStatus(data);
    } catch (error: any) {
      const message = error?.response?.data?.message || "Impossible de charger la sécurité MFA.";
      toast.error(message);
      if (error?.response?.status === 401) {
        navigate(MASTER_LOGIN_PATH, { replace: true });
      }
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await fetchStatus();
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const logout = async () => {
    try {
      await api.post("/master/auth/logout");
    } catch {
      // Ignore logout errors.
    } finally {
      navigate(MASTER_LOGIN_PATH, { replace: true });
    }
  };

  const regenerateRecoveryCodes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verificationPassword.trim() || !verificationCode.trim()) {
      toast.error("Entre ton mot de passe et ton code MFA/recovery.");
      return;
    }

    try {
      setWorking(true);
      const { data } = await api.post<{ recoveryCodes: string[] }>(
        "/master/auth/mfa/recovery-codes/regenerate",
        { password: verificationPassword, code: verificationCode.trim() }
      );
      setLatestRecoveryCodes(Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : []);
      setVerificationPassword("");
      setVerificationCode("");
      toast.success("Nouveaux recovery codes générés.");
      await fetchStatus();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Impossible de régénérer les recovery codes.";
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const disableMfa = async () => {
    if (!verificationPassword.trim() || !verificationCode.trim()) {
      toast.error("Entre ton mot de passe et ton code MFA/recovery pour désactiver.");
      return;
    }

    try {
      setWorking(true);
      await api.post("/master/auth/mfa/disable", {
        password: verificationPassword,
        code: verificationCode.trim(),
      });
      setVerificationPassword("");
      setVerificationCode("");
      setSetupPayload(null);
      setLatestRecoveryCodes(null);
      toast.success("MFA désactivé. Tu peux le réactiver avec ton nouveau téléphone.");
      await fetchStatus();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Impossible de désactiver MFA.";
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const startEnableMfa = async () => {
    try {
      setWorking(true);
      const { data } = await api.post<MfaSetupResponse>("/master/auth/mfa/enable/start");
      setSetupPayload(data);
      setLatestRecoveryCodes(Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : []);
      setEnableCode("");
      toast.success("Configuration MFA lancée. Scanne le QR et confirme le code.");
      await fetchStatus();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Impossible de lancer l'activation MFA.";
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const confirmEnableMfa = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(enableCode)) {
      toast.error("Entre un code Authenticator à 6 chiffres.");
      return;
    }

    try {
      setWorking(true);
      await api.post("/master/auth/mfa/enable/confirm", { code: enableCode });
      setEnableCode("");
      toast.success("MFA activé avec succès.");
      await fetchStatus();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Impossible de confirmer l'activation MFA.";
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const startPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!passwordFlowCurrentPassword.trim() || !passwordFlowMfaOrRecoveryCode.trim()) {
      toast.error("Entre ton mot de passe actuel et ton code MFA/recovery.");
      return;
    }

    try {
      setWorking(true);
      const { data } = await api.post<PasswordChangeStartResponse>(
        "/master/auth/password/change/start",
        {
          password: passwordFlowCurrentPassword,
          code: passwordFlowMfaOrRecoveryCode.trim(),
        }
      );

      if (data?.requiresEmailVerification) {
        setPasswordChangeEmailStep(true);
        setPasswordFlowEmailCode("");
        toast.success("Code de confirmation envoyé par email.");
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || "Impossible de démarrer le changement de mot de passe.";
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const confirmPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(passwordFlowEmailCode)) {
      toast.error("Entre un code email valide à 6 chiffres.");
      return;
    }

    if (newPassword.length < 12) {
      toast.error("Le nouveau mot de passe doit contenir au moins 12 caractères.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    try {
      setWorking(true);
      await api.post("/master/auth/password/change/confirm", {
        emailCode: passwordFlowEmailCode,
        newPassword,
        confirmNewPassword,
      });

      setPasswordFlowCurrentPassword("");
      setPasswordFlowMfaOrRecoveryCode("");
      setPasswordFlowEmailCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordChangeEmailStep(false);

      toast.success("Mot de passe modifié avec succès.");
    } catch (error: any) {
      const message = error?.response?.data?.message || "Impossible de confirmer le changement de mot de passe.";
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const statusTone = useMemo(
    () =>
      mfaIsEnabled
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
        : "border-amber-400/30 bg-amber-400/10 text-amber-100",
    [mfaIsEnabled]
  );

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit border-white/10 bg-sky-400/10 text-sky-100">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Sécurité master
              </Badge>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">MFA & Recovery Codes</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Gère l'activation MFA, la régénération des codes de secours et la récupération de compte en cas de perte du téléphone.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => navigate("/master/schools") }>
                <ArrowLeft className="h-4 w-4" />
                Retour master
              </Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={logout}>
                Déconnexion
              </Button>
            </div>
          </div>
        </section>

        <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-3 border-b border-white/10">
            <CardTitle>État actuel</CardTitle>
            <CardDescription className="text-slate-400">
              Ton compte master: {status?.email || "-"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {loading ? (
              <div className="flex items-center gap-3 text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement de la sécurité...
              </div>
            ) : (
              <>
                <div className={`rounded-2xl border p-4 ${statusTone}`}>
                  <p className="font-semibold">MFA {mfaIsEnabled ? "activé" : "désactivé"}</p>
                  <p className="mt-1 text-sm text-slate-100">
                    Codes de secours restants: {status?.recoveryCodesRemaining ?? 0}
                  </p>
                  <p className="mt-1 text-sm text-slate-100">
                    Dernière génération des recovery codes: {formatDate(status?.recoveryCodesGeneratedAt)}
                  </p>
                </div>

                {mfaIsEnabled ? (
                  <>
                    <form className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4" onSubmit={regenerateRecoveryCodes}>
                      <p className="font-semibold">Régénérer les recovery codes</p>
                      <p className="text-sm text-slate-300">
                        Confirme avec un code MFA ou un recovery code, puis sauvegarde les nouveaux codes immédiatement.
                      </p>
                      <Input
                        type="password"
                        value={verificationPassword}
                        onChange={(event) => setVerificationPassword(event.target.value)}
                        className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        placeholder="Mot de passe master"
                        required
                      />
                      <Input
                        type="text"
                        autoCapitalize="characters"
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32))}
                        className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        placeholder="123456 ou ABCD-EFGH-IJKL-MNOP"
                        required
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button type="submit" className="bg-sky-400 text-black hover:bg-sky-300" disabled={working}>
                          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                          Régénérer
                        </Button>
                        <Button type="button" variant="destructive" onClick={disableMfa} disabled={working}>
                          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                          Désactiver MFA
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="font-semibold">Activer MFA</p>
                    <p className="text-sm text-slate-300">
                      Active MFA pour sécuriser l'accès master. Tu recevras un QR code et des recovery codes.
                    </p>
                    <Button type="button" className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={startEnableMfa} disabled={working}>
                      {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                      Lancer l'activation MFA
                    </Button>
                  </div>
                )}

                {setupPayload && (
                  <form className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4" onSubmit={confirmEnableMfa}>
                    <p className="font-semibold">Finaliser l'activation MFA</p>
                    <img
                      src={setupPayload.qrCodeDataUrl}
                      alt="QR code MFA"
                      className="mx-auto h-44 w-44 rounded-lg bg-white p-2"
                    />
                    <p className="text-xs break-all text-slate-300">
                      Clé manuelle: <span className="font-mono text-slate-100">{setupPayload.manualEntryKey}</span>
                    </p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={enableCode}
                      onChange={(event) => setEnableCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      placeholder="Code Authenticator à 6 chiffres"
                      required
                    />
                    <Button type="submit" className="bg-emerald-400 text-black hover:bg-emerald-300" disabled={working || enableCode.length !== 6}>
                      {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      Confirmer l'activation
                    </Button>
                  </form>
                )}

                {latestRecoveryCodes && latestRecoveryCodes.length > 0 && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                    <p className="font-semibold text-amber-100">Nouveaux recovery codes</p>
                    <p className="mt-1 text-sm text-amber-50/90">
                      Affichage unique: copie-les maintenant. Chaque code est à usage unique.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {latestRecoveryCodes.map((code) => (
                        <div key={code} className="rounded-lg border border-amber-300/20 bg-black/20 px-3 py-2 font-mono text-sm tracking-[0.2em] text-white">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4" onSubmit={passwordChangeEmailStep ? confirmPasswordChange : startPasswordChange}>
                  <p className="font-semibold">Changer le mot de passe</p>
                  <p className="text-sm text-slate-300">
                    Vérification forte: mot de passe actuel + code MFA/recovery, puis confirmation par code email.
                  </p>

                  <Input
                    type="password"
                    value={passwordFlowCurrentPassword}
                    onChange={(event) => setPasswordFlowCurrentPassword(event.target.value)}
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    placeholder="Mot de passe actuel"
                    required
                  />

                  <Input
                    type="text"
                    autoCapitalize="characters"
                    value={passwordFlowMfaOrRecoveryCode}
                    onChange={(event) =>
                      setPasswordFlowMfaOrRecoveryCode(
                        event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32)
                      )
                    }
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    placeholder="Code Authenticator ou recovery code"
                    required
                  />

                  {passwordChangeEmailStep && (
                    <>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={passwordFlowEmailCode}
                        onChange={(event) => setPasswordFlowEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        placeholder="Code email à 6 chiffres"
                        required
                      />

                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        placeholder="Nouveau mot de passe (min 12 caractères)"
                        required
                      />

                      <Input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        placeholder="Confirmer le nouveau mot de passe"
                        required
                      />
                    </>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" className="bg-cyan-400 text-black hover:bg-cyan-300" disabled={working}>
                      {working ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Traitement...
                        </>
                      ) : passwordChangeEmailStep ? (
                        "Confirmer le changement"
                      ) : (
                        "Envoyer le code email"
                      )}
                    </Button>

                    {passwordChangeEmailStep && (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-transparent text-white hover:bg-white/10"
                        onClick={() => {
                          setPasswordChangeEmailStep(false);
                          setPasswordFlowEmailCode("");
                          setNewPassword("");
                          setConfirmNewPassword("");
                        }}
                      >
                        Recommencer
                      </Button>
                    )}
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MasterSecurity;
