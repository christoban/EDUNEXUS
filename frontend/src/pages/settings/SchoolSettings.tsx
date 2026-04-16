import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

const MAX_LOGO_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire le fichier"));
    reader.readAsDataURL(file);
  });

export default function SchoolSettingsPage() {
  const language = useUILanguage();
  const [settings, setSettings] = useState({
    schoolName: "",
    schoolMotto: "",
    schoolLogoUrl: "",
    academicCalendarType: "trimester",
    preferredLanguage: "fr",
    schoolLanguageMode: "francophone",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await api.get("/school-settings");
        setSettings({
          schoolName: data.schoolName || "",
          schoolMotto: data.schoolMotto || "",
          schoolLogoUrl: data.schoolLogoUrl || "",
          academicCalendarType: data.academicCalendarType || "trimester",
          preferredLanguage: data.preferredLanguage || "fr",
          schoolLanguageMode: data.schoolLanguageMode || "francophone",
        });
      } catch (error: any) {
        toast.error(error?.response?.data?.message || t("schoolSettings.loadFail", language));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("schoolSettings.logo.invalidImage", language));
      event.target.value = "";
      return;
    }

    if (file.size > MAX_LOGO_FILE_SIZE) {
      toast.error(t("schoolSettings.logo.tooLarge", language));
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);
      const dataUrl = await readFileAsDataUrl(file);
      setSettings((prev) => ({ ...prev, schoolLogoUrl: dataUrl }));
      toast.success(t("schoolSettings.logo.loaded", language));
    } catch {
      toast.error(t("schoolSettings.logo.loadFail", language));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const clearLogo = () => {
    setSettings((prev) => ({ ...prev, schoolLogoUrl: "" }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        schoolName: settings.schoolName.trim(),
        schoolMotto: settings.schoolMotto.trim(),
        schoolLogoUrl: settings.schoolLogoUrl.trim(),
        academicCalendarType: settings.academicCalendarType,
        preferredLanguage: settings.preferredLanguage,
        schoolLanguageMode: settings.schoolLanguageMode,
        officialLanguages:
          settings.schoolLanguageMode === "anglophone"
            ? ["en"]
            : settings.schoolLanguageMode === "bilingual"
              ? ["fr", "en"]
              : ["fr"],
      };

      const { data } = await api.put("/school-settings", payload);
      setSettings({
        schoolName: data.schoolName || "",
        schoolMotto: data.schoolMotto || "",
        schoolLogoUrl: data.schoolLogoUrl || "",
        academicCalendarType: data.academicCalendarType || "trimester",
        preferredLanguage: data.preferredLanguage || "fr",
        schoolLanguageMode: data.schoolLanguageMode || "francophone",
      });

      window.dispatchEvent(
        new CustomEvent("school-settings-updated", {
          detail: {
            schoolName: data.schoolName || "",
            schoolLogoUrl: data.schoolLogoUrl || "",
          },
        })
      );

      toast.success(t("schoolSettings.saved", language));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("schoolSettings.saveFail", language));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="text-sm text-muted-foreground">{t("schoolSettings.loading", language)}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("schoolSettings.title", language)}</h2>
        <p className="text-muted-foreground">
          {t("schoolSettings.subtitle", language)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("schoolSettings.card.title", language)}</CardTitle>
          <CardDescription>
            {t("schoolSettings.card.description", language)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium">{t("schoolSettings.fields.name", language)}</label>
            <Input
              value={settings.schoolName}
              onChange={(e) =>
                setSettings({ ...settings, schoolName: e.target.value })
              }
              placeholder={t("schoolSettings.fields.namePlaceholder", language)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">{t("schoolSettings.fields.motto", language)}</label>
            <Input
              value={settings.schoolMotto}
              onChange={(e) =>
                setSettings({ ...settings, schoolMotto: e.target.value })
              }
              placeholder={t("schoolSettings.fields.mottoPlaceholder", language)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">{t("schoolSettings.fields.calendar", language)}</label>
            <select
              value={settings.academicCalendarType}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  academicCalendarType: e.target.value as "trimester" | "semester",
                })
              }
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="trimester">{t("schoolSettings.calendar.trimester", language)}</option>
              <option value="semester">{t("schoolSettings.calendar.semester", language)}</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">{t("schoolSettings.fields.languageMode", language)}</label>
            <select
              value={settings.schoolLanguageMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  schoolLanguageMode: e.target.value as
                    | "anglophone"
                    | "francophone"
                    | "bilingual",
                })
              }
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="francophone">{t("schoolSettings.languageMode.francophone", language)}</option>
              <option value="anglophone">{t("schoolSettings.languageMode.anglophone", language)}</option>
              <option value="bilingual">{t("schoolSettings.languageMode.bilingual", language)}</option>
            </select>
          </div>

          {settings.schoolLanguageMode === "bilingual" ? (
            <div>
              <label className="text-sm font-medium">{t("schoolSettings.fields.defaultLanguage", language)}</label>
              <select
                value={settings.preferredLanguage}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    preferredLanguage: e.target.value as "fr" | "en",
                  })
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium">{t("schoolSettings.fields.logo", language)}</label>
            <div className="mt-2 flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={handleLogoFileChange} disabled={uploading} />
              {settings.schoolLogoUrl ? (
                <Button type="button" variant="outline" onClick={clearLogo}>
                  {t("schoolSettings.logo.remove", language)}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("schoolSettings.logo.hint", language)}
            </p>
            {settings.schoolLogoUrl && (
              <div className="mt-2">
                <img
                  src={settings.schoolLogoUrl}
                  alt={t("schoolSettings.logo.alt", language)}
                  className="h-16 w-16 object-contain"
                  onError={() => toast.error(t("schoolSettings.logo.previewFail", language))}
                />
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving || uploading} className="w-full">
            {saving ? t("common.saving", language) : t("schoolSettings.save", language)}
          </Button>

          <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
            <p className="text-sm text-amber-900">
              <strong>{t("schoolSettings.note.title", language)}</strong> {t("schoolSettings.note.text", language)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
