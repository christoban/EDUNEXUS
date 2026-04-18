import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Check, Copy, GraduationCap, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SchoolTemplate } from "@/types";

const initialForm = {
  schoolName: "",
  schoolMotto: "",
  templateKey: "",
  requestedAdminName: "",
  requestedAdminEmail: "",
  contactEmail: "",
  contactPhone: "",
  location: "",
  foundedYear: "",
};

const SchoolOnboarding = () => {
  const [templates, setTemplates] = useState<SchoolTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activationUrl, setActivationUrl] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [form, setForm] = useState(initialForm);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedTemplateKey),
    [selectedTemplateKey, templates]
  );

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const { data } = await api.get("/onboarding/templates");
        const receivedTemplates = Array.isArray(data?.templates) ? data.templates : [];
        setTemplates(receivedTemplates);
        const firstTemplate = receivedTemplates[0];
        if (firstTemplate) {
          setSelectedTemplateKey(firstTemplate.key);
          setForm((current) => ({
            ...current,
            templateKey: firstTemplate.key,
            schoolMotto: current.schoolMotto || firstTemplate.schoolMotto,
          }));
        }
      } catch (error) {
        toast.error("Impossible de charger les templates d'établissement.");
        console.error(error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleTemplateSelect = (template: SchoolTemplate) => {
    setSelectedTemplateKey(template.key);
    setForm((current) => ({
      ...current,
      templateKey: template.key,
      schoolMotto: current.schoolMotto || template.schoolMotto,
    }));
  };

  const copyActivationLink = async () => {
    if (!activationUrl) return;
    await navigator.clipboard.writeText(activationUrl);
    toast.success("Lien copié dans le presse-papiers.");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...form,
        foundedYear: form.foundedYear ? Number(form.foundedYear) : undefined,
      };
      const { data } = await api.post("/onboarding/requests", payload);
      const link = data?.invite?.activationUrl || "";
      setActivationUrl(link);
      toast.success("Demande d'établissement créée.");
    } catch (error: any) {
      const message = error?.response?.data?.message || "La création de l'établissement a échoué.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(62,207,142,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_26%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:48px_48px]" />

      <main className="relative z-10 mx-auto grid min-h-screen max-w-7xl gap-10 px-4 py-8 md:grid-cols-[1.05fr_0.95fr] md:px-8 lg:px-10">
        <section className="flex flex-col justify-between gap-10 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
              <Sparkles className="h-4 w-4" />
              Onboarding établissement
            </div>
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white md:text-6xl">
              Crée un espace d'établissement sans toucher au code.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Choisis un template, complète les informations de base, puis génère un lien d'activation temporaire.
              Le backend crée le tenant, la configuration initiale et l'invitation associée.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" />
              <p className="text-sm text-slate-300">Séparation master / établissement</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <GraduationCap className="mb-3 h-5 w-5 text-sky-300" />
              <p className="text-sm text-slate-300">Templates adaptés au type d'école</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <Check className="mb-3 h-5 w-5 text-emerald-300" />
              <p className="text-sm text-slate-300">Lien d'activation temporaire</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 px-4 py-2">draft</span>
            <span className="rounded-full border border-white/10 px-4 py-2">pending</span>
            <span className="rounded-full border border-white/10 px-4 py-2">approved</span>
            <span className="rounded-full border border-white/10 px-4 py-2">provisioning</span>
            <span className="rounded-full border border-white/10 px-4 py-2">active</span>
          </div>

          <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-50">
            <p className="font-semibold">Stratégie recommandée</p>
            <p className="mt-2 leading-6 text-emerald-50/90">
              Le frontend collecte uniquement les informations métier. Le backend génère le tenant,
              pré-remplit la configuration et produit le lien d'activation. Pas de modification manuelle du code pour chaque nouvel établissement.
            </p>
          </div>
        </section>

        <section className="flex items-start justify-center">
          <Card className="w-full border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-2 border-b border-white/10">
              <CardTitle className="text-2xl">Créer un établissement</CardTitle>
              <CardDescription className="text-slate-400">
                Remplis les informations de base, choisis un template et génère le tenant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {loadingTemplates ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-slate-300">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Chargement des templates...
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Template
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {templates.map((template) => {
                      const isSelected = template.key === selectedTemplateKey;
                      return (
                        <button
                          key={template.key}
                          type="button"
                          onClick={() => handleTemplateSelect(template)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-emerald-400/70 bg-emerald-400/10 ring-2 ring-emerald-400/20"
                              : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{template.label}</p>
                              <p className="mt-1 text-sm text-slate-400">{template.description}</p>
                            </div>
                            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                              {template.systemType}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                            <span className="rounded-full bg-black/20 px-2 py-1">{template.structure}</span>
                            <span className="rounded-full bg-black/20 px-2 py-1">{template.gradingSystem}</span>
                            <span className="rounded-full bg-black/20 px-2 py-1">{template.bulletinFormat}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Nom de l'établissement</label>
                    <Input
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      value={form.schoolName}
                      onChange={(event) => updateField("schoolName", event.target.value)}
                      placeholder="Collège Saint-Pierre"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Année de fondation</label>
                    <Input
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      value={form.foundedYear}
                      onChange={(event) => updateField("foundedYear", event.target.value)}
                      placeholder="2025"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Slogan / devise</label>
                  <Textarea
                    className="min-h-24 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    value={form.schoolMotto}
                    onChange={(event) => updateField("schoolMotto", event.target.value)}
                    placeholder={selectedTemplate?.schoolMotto || "Excellence, discipline, innovation"}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Nom de l'administrateur</label>
                    <Input
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      value={form.requestedAdminName}
                      onChange={(event) => updateField("requestedAdminName", event.target.value)}
                      placeholder="Marie Kouam"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Email administrateur</label>
                    <Input
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      type="email"
                      value={form.requestedAdminEmail}
                      onChange={(event) => updateField("requestedAdminEmail", event.target.value)}
                      placeholder="admin@ecole.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Email de contact</label>
                    <Input
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      type="email"
                      value={form.contactEmail}
                      onChange={(event) => updateField("contactEmail", event.target.value)}
                      placeholder="contact@ecole.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Téléphone</label>
                    <Input
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      value={form.contactPhone}
                      onChange={(event) => updateField("contactPhone", event.target.value)}
                      placeholder="+237 6 00 00 00 00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Localisation</label>
                  <Input
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    value={form.location}
                    onChange={(event) => updateField("location", event.target.value)}
                    placeholder="Douala, Cameroun"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-white">Aperçu du template sélectionné</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>Système: <span className="text-white">{selectedTemplate?.systemType || "-"}</span></div>
                    <div>Structure: <span className="text-white">{selectedTemplate?.structure || "-"}</span></div>
                    <div>Notation: <span className="text-white">{selectedTemplate?.gradingSystem || "-"}</span></div>
                    <div>Bulletin: <span className="text-white">{selectedTemplate?.bulletinFormat || "-"}</span></div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting || loadingTemplates}
                  className="h-12 w-full rounded-xl bg-emerald-400 text-black hover:bg-emerald-300"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création en cours...
                    </span>
                  ) : (
                    "Créer l'établissement"
                  )}
                </Button>
              </form>

              {activationUrl ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                  <p className="font-semibold">Lien d'activation généré</p>
                  <p className="mt-2 break-all text-emerald-50/90">{activationUrl}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={copyActivationLink} className="border-emerald-300/40 bg-transparent text-emerald-50 hover:bg-emerald-400/15">
                      <Copy className="mr-2 h-4 w-4" />
                      Copier le lien
                    </Button>
                    <Button asChild type="button" className="bg-white text-black hover:bg-slate-100">
                      <Link to={activationUrl.replace(window.location.origin, "")}>Ouvrir la page</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default SchoolOnboarding;
