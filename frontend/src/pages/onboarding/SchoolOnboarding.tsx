import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Building2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type WizardStep = "token" | "school" | "questions" | "admin" | "review";

const STEPS: WizardStep[] = ["token", "school", "questions", "admin", "review"];

type WizardState = {
  step: WizardStep;
};

type WizardAction = { type: "NEXT" } | { type: "BACK" } | { type: "GOTO"; step: WizardStep };

const wizardReducer = (state: WizardState, action: WizardAction): WizardState => {
  const index = STEPS.indexOf(state.step);
  if (action.type === "NEXT") {
    return { step: STEPS[Math.min(index + 1, STEPS.length - 1)] };
  }
  if (action.type === "BACK") {
    return { step: STEPS[Math.max(index - 1, 0)] };
  }
  return { step: action.step };
};

type InviteResponse = {
  invite?: {
    token: string;
    requestedAdminName: string;
    requestedAdminEmail: string;
    schoolName: string;
    templateKey: string;
    status: "pending" | "accepted" | "expired";
    expiresAt: string;
  };
  school?: {
    schoolName?: string;
    requestedAdminEmail?: string;
    systemType?: "francophone" | "anglophone" | "bilingual";
    dbName?: string;
  };
};

const schoolInfoSchema = z.object({
  schoolName: z.string().trim().min(3, "Le nom de l'établissement est requis"),
  address: z.string().trim().min(3, "L'adresse est requise"),
  city: z.string().trim().min(2, "La ville est requise"),
  region: z.string().trim().min(2, "La région est requise"),
  phone: z.string().trim().min(8, "Le numéro de téléphone est invalide"),
  email: z.string().trim().email("Email établissement invalide"),
  logoUrl: z.string().trim().url("URL du logo invalide").optional().or(z.literal("")),
});

const adminSchema = z
  .object({
    title: z.string().trim().min(2, "Le titre administrateur est requis"),
    firstName: z.string().trim().min(2, "Le prénom est requis"),
    lastName: z.string().trim().min(2, "Le nom est requis"),
    email: z.string().trim().email("Email administrateur invalide"),
    password: z.string().min(6, "Mot de passe: minimum 6 caractères"),
    confirmPassword: z.string().min(6, "Confirmation du mot de passe requise"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  });

const detectTemplate = (answers: {
  languageMode: "francophone" | "anglophone" | "bilingual";
  schoolLevel: "primary" | "secondary" | "multi";
  ownership: "public" | "private" | "faith";
  orientation: "general" | "technical" | "mixed";
}) => {
  let key = "fr_secondary";
  let label = "Lycée francophone privé détecté";

  if (answers.languageMode === "bilingual" && answers.schoolLevel !== "primary") {
    key = "bilingual_complex";
    label = answers.ownership === "public" ? "Lycée bilingue public détecté" : "Lycée bilingue détecté";
  } else if (answers.languageMode === "anglophone" && answers.schoolLevel === "primary") {
    key = "en_primary";
    label = "Primary school anglophone détectée";
  } else if (answers.schoolLevel === "primary") {
    key = "fr_primary";
    label = answers.ownership === "public" ? "École primaire publique détectée" : "École primaire détectée";
  } else if (answers.orientation === "technical") {
    key = "technical_school";
    label = "Lycée technique détecté";
  }

  return { key, label };
};

const titleFromTemplateKey = (templateKey: string) => {
  if (templateKey === "en_primary") return "Head Teacher";
  if (templateKey === "fr_primary") return "Directeur / Directrice";
  if (templateKey === "bilingual_complex") return "Proviseur Général";
  if (templateKey === "technical_school") return "Proviseur";
  if (templateKey === "fr_secondary") return "Proviseur / Directeur";
  return "Principal / Proviseur";
};

const SchoolOnboarding = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [wizard, dispatch] = useReducer(wizardReducer, { step: "token" } as WizardState);

  const [loadingToken, setLoadingToken] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [invite, setInvite] = useState<InviteResponse["invite"] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [schoolInfo, setSchoolInfo] = useState({
    schoolName: "",
    address: "",
    city: "",
    region: "",
    phone: "",
    email: "",
    logoUrl: "",
  });

  const [schoolErrors, setSchoolErrors] = useState<Record<string, string>>({});

  const [answers, setAnswers] = useState({
    languageMode: "francophone" as "francophone" | "anglophone" | "bilingual",
    schoolLevel: "secondary" as "primary" | "secondary" | "multi",
    ownership: "private" as "public" | "private" | "faith",
    orientation: "general" as "general" | "technical" | "mixed",
  });

  const [admin, setAdmin] = useState({
    title: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [adminErrors, setAdminErrors] = useState<Record<string, string>>({});

  const detectedTemplate = useMemo(() => detectTemplate(answers), [answers]);
  const stepIndex = STEPS.indexOf(wizard.step) + 1;

  const schoolNameRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const regionRef = useRef<HTMLInputElement | null>(null);
  const adminFirstRef = useRef<HTMLInputElement | null>(null);
  const adminEmailRef = useRef<HTMLInputElement | null>(null);

  const schoolValid = useMemo(() => schoolInfoSchema.safeParse(schoolInfo).success, [schoolInfo]);
  const adminValid = useMemo(() => adminSchema.safeParse(admin).success, [admin]);

  useEffect(() => {
    const bootstrapInvite = async () => {
      if (!token) {
        setTokenError("Ce lien d'onboarding est invalide. Demande une nouvelle invitation.");
        setLoadingToken(false);
        return;
      }

      try {
        setLoadingToken(true);
        const { data } = await api.get<InviteResponse>(`/onboarding/invite/${token}`);
        const incomingInvite = data?.invite || null;
        if (!incomingInvite) {
          setTokenError("Invitation introuvable.");
          return;
        }

        setInvite(incomingInvite);
        setSchoolInfo((current) => ({
          ...current,
          schoolName: data?.school?.schoolName || incomingInvite.schoolName || current.schoolName,
          email: incomingInvite.requestedAdminEmail || data?.school?.requestedAdminEmail || current.email,
        }));

        setAnswers((current) => ({
          ...current,
          languageMode: data?.school?.systemType || current.languageMode,
        }));

        setAdmin((current) => ({
          ...current,
          title: titleFromTemplateKey(incomingInvite.templateKey || "fr_secondary"),
          email: incomingInvite.requestedAdminEmail || current.email,
        }));
      } catch (error: any) {
        const status = Number(error?.response?.status || 0);
        if (status === 410) {
          setTokenError("Ce lien est expiré ou déjà utilisé.");
        } else if (status === 404) {
          setTokenError("Invitation introuvable.");
        } else {
          setTokenError(error?.response?.data?.message || "Impossible de vérifier l'invitation.");
        }
      } finally {
        setLoadingToken(false);
      }
    };

    bootstrapInvite();
  }, [token]);

  const goNextFromSchool = () => {
    const parsed = schoolInfoSchema.safeParse(schoolInfo);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const key = String(i.path?.[0] || "");
        map[key] = i.message;
      });
      setSchoolErrors(map);
      toast.error(parsed.error.issues[0]?.message || "Veuillez corriger les informations de l'école");
      // focus first invalid field
      const firstKey = parsed.error.issues[0]?.path?.[0];
      if (firstKey === "schoolName") schoolNameRef.current?.focus();
      else if (firstKey === "address") addressRef.current?.focus();
      else if (firstKey === "city") cityRef.current?.focus();
      else if (firstKey === "region") regionRef.current?.focus();
      return;
    }
    setSchoolErrors({});
    dispatch({ type: "NEXT" });
  };

  const goNextFromAdmin = () => {
    const parsed = adminSchema.safeParse(admin);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const key = String(i.path?.[0] || "");
        map[key] = i.message;
      });
      setAdminErrors(map);
      toast.error(parsed.error.issues[0]?.message || "Veuillez corriger les informations administrateur");
      const firstKey = parsed.error.issues[0]?.path?.[0];
      if (firstKey === "firstName") adminFirstRef.current?.focus();
      else if (firstKey === "email") adminEmailRef.current?.focus();
      return;
    }
    setAdminErrors({});
    dispatch({ type: "NEXT" });
  };

  const submitOnboarding = async () => {
    if (!token) {
      toast.error("Token d'invitation manquant.");
      return;
    }

    const adminParse = adminSchema.safeParse(admin);
    const schoolParse = schoolInfoSchema.safeParse(schoolInfo);

    if (!adminParse.success || !schoolParse.success) {
      if (!schoolParse.success) {
        const map: Record<string, string> = {};
        schoolParse.error.issues.forEach((i) => (map[String(i.path?.[0] || "")] = i.message));
        setSchoolErrors(map);
      }
      if (!adminParse.success) {
        const map: Record<string, string> = {};
        adminParse.error.issues.forEach((i) => (map[String(i.path?.[0] || "")] = i.message));
        setAdminErrors(map);
      }
      toast.error("Formulaire incomplet. Vérifie toutes les étapes.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/onboarding/join/${token}`, {
        adminName: `${admin.title} ${admin.firstName} ${admin.lastName}`.trim(),
        adminEmail: admin.email,
        adminPassword: admin.password,
        schoolInfo,
        questionnaire: answers,
        detectedTemplate,
      });
      toast.success("Soumission effectuée. L'établissement passe en attente de finalisation.");
      navigate("/onboarding/confirmation");
    } catch (error: any) {
      const rawMessage = String(error?.response?.data?.message || "La soumission a échoué");
      if (/already exists/i.test(rawMessage)) {
        toast.error("Cet email administrateur existe déjà. Utilise un autre email.");
      } else if (/expired|already used|invite/i.test(rawMessage.toLowerCase())) {
        toast.error("Le lien d'invitation n'est plus valide.");
        setTokenError("Le lien d'invitation n'est plus valide.");
        dispatch({ type: "GOTO", step: "token" });
      } else {
        toast.error(rawMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white md:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_33%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_30%)]" />

      <main className="relative z-10 mx-auto max-w-4xl space-y-6">
        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardHeader className="space-y-3 border-b border-white/10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
              <Sparkles className="h-4 w-4" />
              Onboarding établissement
            </div>
            <CardTitle className="text-2xl">Configuration guidée en 5 étapes</CardTitle>
            <CardDescription className="text-slate-400">Étape {stepIndex}/5</CardDescription>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(stepIndex / 5) * 100}%` }} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {wizard.step === "token" && (
              <section className="space-y-4">
                {loadingToken ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-slate-300">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Vérification du token d'invitation...
                  </div>
                ) : tokenError ? (
                  <div className="space-y-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
                    <p>{tokenError}</p>
                    <Button onClick={() => navigate("/onboarding/school")}>Demander nouvelle invitation</Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-200">
                      <p className="font-semibold text-white">Invitation validée</p>
                      <p className="mt-2">École: {invite?.schoolName || "-"}</p>
                      <p>Email administrateur: {invite?.requestedAdminEmail || "-"}</p>
                      <p>Expire le: {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleString() : "-"}</p>
                    </div>
                    <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={() => dispatch({ type: "NEXT" })}>
                      Continuer vers les infos école
                    </Button>
                  </>
                )}
              </section>
            )}

            {wizard.step === "school" && (
              <section className="grid gap-4">
                <Input ref={schoolNameRef} className={schoolErrors.schoolName ? 'border-red-400' : ''} value={schoolInfo.schoolName} onChange={(event) => setSchoolInfo((s) => ({ ...s, schoolName: event.target.value }))} placeholder="Nom de l'école" aria-invalid={!!schoolErrors.schoolName} />
                {schoolErrors.schoolName && <p className="text-xs text-red-300">{schoolErrors.schoolName}</p>}
                <Input value={schoolInfo.address} onChange={(event) => setSchoolInfo((s) => ({ ...s, address: event.target.value }))} placeholder="Adresse" />
                {schoolErrors.address && <p className="text-xs text-red-300">{schoolErrors.address}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  <Input ref={cityRef} className={schoolErrors.city ? 'border-red-400' : ''} value={schoolInfo.city} onChange={(event) => setSchoolInfo((s) => ({ ...s, city: event.target.value }))} placeholder="Ville" aria-invalid={!!schoolErrors.city} />
                  {schoolErrors.city && <p className="text-xs text-red-300">{schoolErrors.city}</p>}
                  <Input ref={regionRef} value={schoolInfo.region} onChange={(event) => setSchoolInfo((s) => ({ ...s, region: event.target.value }))} placeholder="Région" />
                  {schoolErrors.region && <p className="text-xs text-red-300">{schoolErrors.region}</p>}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input className={schoolErrors.phone ? 'border-red-400' : ''} value={schoolInfo.phone} onChange={(event) => setSchoolInfo((s) => ({ ...s, phone: event.target.value }))} placeholder="Téléphone" aria-invalid={!!schoolErrors.phone} />
                  {schoolErrors.phone && <p className="text-xs text-red-300">{schoolErrors.phone}</p>}
                  <Input className={schoolErrors.email ? 'border-red-400' : ''} value={schoolInfo.email} onChange={(event) => setSchoolInfo((s) => ({ ...s, email: event.target.value }))} placeholder="Email" type="email" aria-invalid={!!schoolErrors.email} />
                  {schoolErrors.email && <p className="text-xs text-red-300">{schoolErrors.email}</p>}
                </div>
                <Input value={schoolInfo.logoUrl} onChange={(event) => setSchoolInfo((s) => ({ ...s, logoUrl: event.target.value }))} placeholder="https://.../logo.png (optionnel)" />
                {schoolErrors.logoUrl && <p className="text-xs text-red-300">{schoolErrors.logoUrl}</p>}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => dispatch({ type: "BACK" })}>Retour</Button>
                  <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={goNextFromSchool} disabled={!schoolValid}>Suivant</Button>
                </div>
              </section>
            )}

            {wizard.step === "questions" && (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <select className="rounded-md border border-white/10 bg-white/5 p-3" value={answers.languageMode} onChange={(event) => setAnswers((s) => ({ ...s, languageMode: event.target.value as any }))}>
                    <option value="francophone">Système francophone</option>
                    <option value="anglophone">Système anglophone</option>
                    <option value="bilingual">Système bilingue</option>
                  </select>
                  <select className="rounded-md border border-white/10 bg-white/5 p-3" value={answers.schoolLevel} onChange={(event) => setAnswers((s) => ({ ...s, schoolLevel: event.target.value as any }))}>
                    <option value="primary">Primaire</option>
                    <option value="secondary">Secondaire</option>
                    <option value="multi">Multi-niveaux</option>
                  </select>
                  <select className="rounded-md border border-white/10 bg-white/5 p-3" value={answers.ownership} onChange={(event) => setAnswers((s) => ({ ...s, ownership: event.target.value as any }))}>
                    <option value="public">Public</option>
                    <option value="private">Privé</option>
                    <option value="faith">Confessionnel</option>
                  </select>
                  <select className="rounded-md border border-white/10 bg-white/5 p-3" value={answers.orientation} onChange={(event) => setAnswers((s) => ({ ...s, orientation: event.target.value as any }))}>
                    <option value="general">Général</option>
                    <option value="technical">Technique</option>
                    <option value="mixed">Mixte</option>
                  </select>
                </div>
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <p className="font-semibold text-emerald-100">{detectedTemplate.label}</p>
                  <p className="text-sm text-emerald-50/90">Template proposé: {detectedTemplate.key}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => dispatch({ type: "BACK" })}>Retour</Button>
                  <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={() => dispatch({ type: "NEXT" })}>Suivant</Button>
                </div>
              </section>
            )}

            {wizard.step === "admin" && (
              <section className="space-y-4">
                <Input className={adminErrors.title ? 'border-red-400' : ''} value={admin.title} onChange={(event) => setAdmin((s) => ({ ...s, title: event.target.value }))} placeholder="Titre" aria-invalid={!!adminErrors.title} />
                {adminErrors.title && <p className="text-xs text-red-300">{adminErrors.title}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  <Input ref={adminFirstRef} className={adminErrors.firstName ? 'border-red-400' : ''} value={admin.firstName} onChange={(event) => setAdmin((s) => ({ ...s, firstName: event.target.value }))} placeholder="Prénom" aria-invalid={!!adminErrors.firstName} />
                  {adminErrors.firstName && <p className="text-xs text-red-300">{adminErrors.firstName}</p>}
                  <Input className={adminErrors.lastName ? 'border-red-400' : ''} value={admin.lastName} onChange={(event) => setAdmin((s) => ({ ...s, lastName: event.target.value }))} placeholder="Nom" aria-invalid={!!adminErrors.lastName} />
                  {adminErrors.lastName && <p className="text-xs text-red-300">{adminErrors.lastName}</p>}
                </div>
                <Input ref={adminEmailRef} className={adminErrors.email ? 'border-red-400' : ''} value={admin.email} onChange={(event) => setAdmin((s) => ({ ...s, email: event.target.value }))} placeholder="Email admin" type="email" aria-invalid={!!adminErrors.email} />
                {adminErrors.email && <p className="text-xs text-red-300">{adminErrors.email}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  <Input className={adminErrors.password ? 'border-red-400' : ''} value={admin.password} onChange={(event) => setAdmin((s) => ({ ...s, password: event.target.value }))} placeholder="Mot de passe" type="password" aria-invalid={!!adminErrors.password} />
                  {adminErrors.password && <p className="text-xs text-red-300">{adminErrors.password}</p>}
                  <Input className={adminErrors.confirmPassword ? 'border-red-400' : ''} value={admin.confirmPassword} onChange={(event) => setAdmin((s) => ({ ...s, confirmPassword: event.target.value }))} placeholder="Confirmer mot de passe" type="password" aria-invalid={!!adminErrors.confirmPassword} />
                  {adminErrors.confirmPassword && <p className="text-xs text-red-300">{adminErrors.confirmPassword}</p>}
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                  Titre suggéré: <span className="font-semibold text-white">{titleFromTemplateKey(detectedTemplate.key)}</span>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => dispatch({ type: "BACK" })}>Retour</Button>
                  <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={goNextFromAdmin} disabled={!adminValid}>Suivant</Button>
                </div>
              </section>
            )}

            {wizard.step === "review" && (
              <section className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="mb-2 font-semibold text-white">Récapitulatif complet</p>
                  <p>École: {schoolInfo.schoolName}</p>
                  <p>Adresse: {schoolInfo.address}, {schoolInfo.city}, {schoolInfo.region}</p>
                  <p>Contact: {schoolInfo.phone} · {schoolInfo.email}</p>
                  <p>Template détecté: {detectedTemplate.label} ({detectedTemplate.key})</p>
                  <p>Admin: {admin.title} {admin.firstName} {admin.lastName} · {admin.email}</p>
                </div>
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-50">
                  Après soumission, la demande passe en attente de validation et tu recevras un email de suivi.
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => dispatch({ type: "BACK" })}>Retour</Button>
                  <Button className="bg-emerald-400 text-black hover:bg-emerald-300" disabled={submitting} onClick={submitOnboarding}>
                    {submitting ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Soumission...</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Soumettre</span>
                    )}
                  </Button>
                </div>
              </section>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Building2 className="h-4 w-4" />
          Flux unique d'onboarding. Les anciennes pages join/invite/activate sont consolidées ici.
        </div>
      </main>
    </div>
  );
};

export default SchoolOnboarding;
