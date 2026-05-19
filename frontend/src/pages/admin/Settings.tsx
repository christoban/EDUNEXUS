import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Settings = {
  schoolName?: string;
  schoolMotto?: string;
  schoolLogoUrl?: string;
  academicCalendarType?: string;
  preferredLanguage?: string;
  schoolLanguageMode?: string;
  timezone?: string;
  currency?: string;
};

const AdminSettings = () => {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/school-settings").then(({ data }) => setSettings(data || {}))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings.schoolName?.trim()) { toast.error("Le nom de l'école est requis"); return; }
    if (!settings.schoolMotto?.trim()) { toast.error("La devise est requise"); return; }
    setSaving(true);
    try {
      await api.put("/school-settings", settings);
      toast.success("Paramètres enregistrés");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setSaving(false); }
  };

  const field = (label: string, key: keyof Settings, type = "text") => (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-widest text-slate-400">{label}</label>
      <Input
        type={type}
        value={settings[key] ?? ""}
        onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
        className="border-white/10 bg-white/5 text-white"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Paramètres</h1>
          <p className="mt-1 text-slate-400">Configuration générale de l'établissement</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" />Chargement...</div>
        ) : (
          <div className="space-y-6">
            <Card className="border-white/10 bg-slate-900/90 text-white">
              <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                {field("Nom de l'établissement", "schoolName")}
                {field("Devise / Motto", "schoolMotto")}
                {field("URL du logo", "schoolLogoUrl", "url")}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/90 text-white">
              <CardHeader><CardTitle className="text-base">Configuration académique</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest text-slate-400">Calendrier académique</label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-white/5 p-3 text-white"
                    value={settings.academicCalendarType ?? "trimester"}
                    onChange={(e) => setSettings((s) => ({ ...s, academicCalendarType: e.target.value }))}
                  >
                    <option value="trimester">Trimestriel (3 trimestres)</option>
                    <option value="semester">Semestriel</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest text-slate-400">Langue préférée</label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-white/5 p-3 text-white"
                    value={settings.preferredLanguage ?? "fr"}
                    onChange={(e) => setSettings((s) => ({ ...s, preferredLanguage: e.target.value }))}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest text-slate-400">Sous-système</label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-white/5 p-3 text-white"
                    value={settings.schoolLanguageMode ?? "francophone"}
                    onChange={(e) => setSettings((s) => ({ ...s, schoolLanguageMode: e.target.value }))}
                  >
                    <option value="francophone">Francophone</option>
                    <option value="anglophone">Anglophone</option>
                    <option value="bilingual">Bilingue</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Button className="bg-emerald-400 text-black hover:bg-emerald-300 w-full" disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer les paramètres
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
