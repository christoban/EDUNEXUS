import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useUILanguage } from "@/hooks/useUILanguage";
import type { AcademicPeriod, SchoolSettings, Section, SubSystem, academicYear } from "@/types";

const cycleOptions = ["maternelle", "primaire", "secondaire_1", "secondaire_2", "technique"] as const;
const gradingScales = ["OVER_20", "PERCENT", "GRADES_AE", "COMPETENCY_ANA"] as const;
const periodTypes = ["SEQUENCES_6", "TERMS_3", "MONTHLY_9"] as const;
const periodKindOptions = ["SEQUENCE", "TERM", "MONTH"] as const;
const bulletinTemplates = ["", "FR", "EN", "PRIMARY", "KINDERGARTEN"] as const;

type SectionDraft = {
  subSystem: string;
  name: string;
  language: "fr" | "en";
  cycle: (typeof cycleOptions)[number];
  isActive: boolean;
};

type SubSystemDraft = {
  name: string;
  gradingScale: (typeof gradingScales)[number];
  periodType: (typeof periodTypes)[number];
  hasCoefficientBySubject: boolean;
  passThreshold: number;
  bulletinTemplate: string;
  isActive: boolean;
};

type PeriodDraft = {
  academicYear: string;
  section: string;
  type: (typeof periodKindOptions)[number];
  number: number;
  trimester: number | null;
  startDate: string;
  endDate: string;
  isBulletinPeriod: boolean;
  isCouncilPeriod: boolean;
};

const blankSectionDraft: SectionDraft = {
  subSystem: "",
  name: "",
  language: "fr",
  cycle: "secondaire_1",
  isActive: true,
};

const blankPeriodDraft: PeriodDraft = {
  academicYear: "",
  section: "",
  type: "SEQUENCE",
  number: 1,
  trimester: null,
  startDate: "",
  endDate: "",
  isBulletinPeriod: true,
  isCouncilPeriod: false,
};

const languageLabels = {
  fr: {
    title: "Configuration établissement",
    subtitle: "Gérez les paramètres école, sections, sous-systèmes et périodes sans redeploiement.",
    refresh: "Rafraîchir",
    saving: "Enregistrement...",
    saved: "Configuration enregistrée",
    school: "Établissement",
    sections: "Sections",
    subsystems: "Sous-systèmes",
    periods: "Périodes académiques",
    name: "Nom",
    motto: "Devise",
    calendar: "Calendrier académique",
    mode: "Mode linguistique",
    preferredLanguage: "Langue par défaut",
    cycles: "Cycles gérés",
    multipleCycles: "Plusieurs cycles",
    officialLanguages: "Langues officielles",
    attendancePolicy: "Politique de présence",
    councilPolicy: "Politique de conseil",
    bulletinPolicy: "Politique du bulletin",
    lateAsAbsence: "Compter les retards comme absences",
    excusedAsAbsence: "Compter les absences excusées comme absences",
    decisionMode: "Mode de décision",
    maxAbsences: "Absences max avant revue",
    blockOnUnpaidFees: "Bloquer le bulletin en cas d'impayés",
    allowedOutstanding: "Solde impayé autorisé",
    logo: "Logo",
    save: "Enregistrer",
    createSection: "Créer une section",
    editSection: "Modifier",
    createSubsystem: "Synchroniser les sous-systèmes par défaut",
    editSubsystem: "Mettre à jour",
    createPeriod: "Créer une période",
    updatePeriod: "Mettre à jour la période",
    openEdit: "Modifier",
    bulletinTemplate: "Modèle bulletin",
    passThreshold: "Seuil de réussite /20",
    coefficientMode: "Coefficients par matière",
    councilPeriod: "Période conseil",
    bulletinPeriod: "Période bulletin",
    academicYear: "Année académique",
    section: "Section",
    type: "Type",
    number: "Numéro",
    trimester: "Trimestre",
    startDate: "Début",
    endDate: "Fin",
    active: "Actif",
    language: "Langue",
    cycle: "Cycle",
    gradingScale: "Échelle",
    periodType: "Découpage",
    bulletinTemplateHint: "Laisser vide pour la détection automatique.",
    noSections: "Aucune section définie.",
    noSubsystems: "Aucun sous-système trouvé.",
    noPeriods: "Aucune période enregistrée.",
    cyclesHint: "Les cycles cochés sont proposés dans toute la plateforme.",
  },
  en: {
    title: "School Configuration",
    subtitle: "Manage school settings, sections, subsystems, and periods without redeploying.",
    refresh: "Refresh",
    saving: "Saving...",
    saved: "Configuration saved",
    school: "School",
    sections: "Sections",
    subsystems: "Sub-systems",
    periods: "Academic periods",
    name: "Name",
    motto: "Motto",
    calendar: "Academic calendar",
    mode: "Language mode",
    preferredLanguage: "Default language",
    cycles: "Managed cycles",
    multipleCycles: "Multiple cycles",
    officialLanguages: "Official languages",
    attendancePolicy: "Attendance policy",
    councilPolicy: "Council policy",
    bulletinPolicy: "Bulletin policy",
    lateAsAbsence: "Count late arrivals as absences",
    excusedAsAbsence: "Count excused absences as absences",
    decisionMode: "Decision mode",
    maxAbsences: "Max absences before review",
    blockOnUnpaidFees: "Block bulletin on unpaid fees",
    allowedOutstanding: "Allowed outstanding balance",
    logo: "Logo",
    save: "Save",
    createSection: "Create section",
    editSection: "Edit",
    createSubsystem: "Sync default subsystems",
    editSubsystem: "Update",
    createPeriod: "Create period",
    updatePeriod: "Update period",
    openEdit: "Edit",
    bulletinTemplate: "Bulletin template",
    passThreshold: "Pass threshold /20",
    coefficientMode: "Coefficient by subject",
    councilPeriod: "Council period",
    bulletinPeriod: "Bulletin period",
    academicYear: "Academic year",
    section: "Section",
    type: "Type",
    number: "Number",
    trimester: "Trimester",
    startDate: "Start",
    endDate: "End",
    active: "Active",
    language: "Language",
    cycle: "Cycle",
    gradingScale: "Scale",
    periodType: "Period type",
    bulletinTemplateHint: "Leave empty for automatic detection.",
    noSections: "No sections defined.",
    noSubsystems: "No subsystems found.",
    noPeriods: "No periods saved.",
    cyclesHint: "Checked cycles are made available across the platform.",
  },
} as const;

const toDateInputValue = (value: string | Date | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const languageModeToOfficialLanguages = (mode: SchoolSettings["schoolLanguageMode"]) => {
  if (mode === "anglophone") return ["en"] as Array<"fr" | "en">;
  if (mode === "bilingual") return ["fr", "en"] as Array<"fr" | "en">;
  return ["fr"] as Array<"fr" | "en">;
};

export default function SchoolConfigurationPage() {
  const language = useUILanguage();
  const labels = languageLabels[language];

  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    schoolName: "",
    schoolMotto: "",
    schoolLogoUrl: "",
    academicCalendarType: "trimester",
    preferredLanguage: "fr",
    schoolLanguageMode: "francophone",
    mode: "simple_fr",
    cycles: ["secondaire_1", "secondaire_2"],
    hasMultipleCycles: true,
    officialLanguages: ["fr"],
    attendanceLateAsAbsence: true,
    attendanceExcusedCountsAsAbsence: false,
    councilDecisionMode: "automatic",
    councilPassAverageThreshold: 50,
    councilMaxAbsences: 10,
    bulletinBlockOnUnpaidFees: false,
    bulletinAllowedOutstandingBalance: 0,
  });
  const [subsystems, setSubsystems] = useState<SubSystem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [academicYears, setAcademicYears] = useState<academicYear[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSchool, setSavingSchool] = useState(false);
  const [sectionDraft, setSectionDraft] = useState<SectionDraft>(blankSectionDraft);
  const [periodDraft, setPeriodDraft] = useState<PeriodDraft>(blankPeriodDraft);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, SectionDraft>>({});
  const [subsystemDrafts, setSubsystemDrafts] = useState<Record<string, SubSystemDraft>>({});
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [savingSubsystemId, setSavingSubsystemId] = useState<string | null>(null);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [syncingSubsystems, setSyncingSubsystems] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, sectionsRes, subsystemsRes, yearsRes, periodsRes] = await Promise.all([
        api.get<SchoolSettings>("/school-settings"),
        api.get("/core-domain/sections"),
        api.get("/core-domain/subsystems"),
        api.get("/academic-years?page=1&limit=100"),
        api.get("/core-domain/academic-periods"),
      ]);

      const loadedSettings = settingsRes.data;
      setSchoolSettings({
        ...loadedSettings,
        schoolLogoUrl: loadedSettings.schoolLogoUrl || "",
        cycles: loadedSettings.cycles || ["secondaire_1", "secondaire_2"],
        officialLanguages: loadedSettings.officialLanguages || ["fr"],
        attendanceLateAsAbsence:
          typeof loadedSettings.attendanceLateAsAbsence === "boolean"
            ? loadedSettings.attendanceLateAsAbsence
            : true,
        attendanceExcusedCountsAsAbsence:
          typeof loadedSettings.attendanceExcusedCountsAsAbsence === "boolean"
            ? loadedSettings.attendanceExcusedCountsAsAbsence
            : false,
        councilDecisionMode: loadedSettings.councilDecisionMode || "automatic",
        councilPassAverageThreshold:
          typeof loadedSettings.councilPassAverageThreshold === "number"
            ? loadedSettings.councilPassAverageThreshold
            : 50,
        councilMaxAbsences:
          typeof loadedSettings.councilMaxAbsences === "number"
            ? loadedSettings.councilMaxAbsences
            : 10,
        bulletinBlockOnUnpaidFees:
          typeof loadedSettings.bulletinBlockOnUnpaidFees === "boolean"
            ? loadedSettings.bulletinBlockOnUnpaidFees
            : false,
        bulletinAllowedOutstandingBalance:
          typeof loadedSettings.bulletinAllowedOutstandingBalance === "number"
            ? loadedSettings.bulletinAllowedOutstandingBalance
            : 0,
      });

      const loadedSections = sectionsRes.data.sections || [];
      const loadedSubsystems = subsystemsRes.data.subsystems || [];
      const loadedYears = yearsRes.data.years || yearsRes.data.academicYears || [];
      const loadedPeriods = periodsRes.data.periods || [];

      setSections(loadedSections);
      setSubsystems(loadedSubsystems);
      setAcademicYears(loadedYears);
      setPeriods(loadedPeriods);

      const sectionInitials: Record<string, SectionDraft> = {};
      for (const section of loadedSections as Section[]) {
        sectionInitials[section._id] = {
          subSystem: typeof section.subSystem === "string" ? section.subSystem : section.subSystem?._id || "",
          name: section.name,
          language: section.language,
          cycle: section.cycle,
          isActive: section.isActive,
        };
      }
      setSectionDrafts(sectionInitials);

      const subsystemInitials: Record<string, SubSystemDraft> = {};
      for (const subsystem of loadedSubsystems as SubSystem[]) {
        subsystemInitials[subsystem._id] = {
          name: subsystem.name,
          gradingScale: subsystem.gradingScale,
          periodType: subsystem.periodType,
          hasCoefficientBySubject: subsystem.hasCoefficientBySubject,
          passThreshold: subsystem.passThreshold,
          bulletinTemplate: subsystem.bulletinTemplate || "",
          isActive: subsystem.isActive,
        };
      }
      setSubsystemDrafts(subsystemInitials);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || labels.saved);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSchoolSave = async () => {
    try {
      setSavingSchool(true);
      const payload = {
        ...schoolSettings,
        officialLanguages: languageModeToOfficialLanguages(schoolSettings.schoolLanguageMode),
      };
      const { data } = await api.put("/school-settings", payload);
      setSchoolSettings({
        ...data,
        schoolLogoUrl: data.schoolLogoUrl || "",
        cycles: data.cycles || ["secondaire_1", "secondaire_2"],
        officialLanguages: data.officialLanguages || ["fr"],
      });
      window.dispatchEvent(new CustomEvent("school-settings-updated"));
      toast.success(labels.saved);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || labels.saved);
    } finally {
      setSavingSchool(false);
    }
  };

  const handleSyncSubsystems = async () => {
    try {
      setSyncingSubsystems(true);
      await api.post("/core-domain/subsystems/upsert-defaults");
      toast.success(labels.saved);
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || labels.saved);
    } finally {
      setSyncingSubsystems(false);
    }
  };

  const handleCreateSection = async () => {
    try {
      await api.post("/core-domain/sections", sectionDraft);
      toast.success(labels.saved);
      setSectionDraft(blankSectionDraft);
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || labels.saved);
    }
  };

  const handleUpdateSection = async (sectionId: string) => {
    try {
      setSavingSectionId(sectionId);
      const draft = sectionDrafts[sectionId];
      if (!draft) return;
      await api.patch(`/core-domain/sections/${sectionId}`, draft);
      toast.success(labels.saved);
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || labels.saved);
    } finally {
      setSavingSectionId(null);
    }
  };

  const handleUpdateSubsystem = async (subsystemId: string) => {
    try {
      setSavingSubsystemId(subsystemId);
      const draft = subsystemDrafts[subsystemId];
      if (!draft) return;
      await api.patch(`/core-domain/subsystems/${subsystemId}`, draft);
      toast.success(labels.saved);
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || labels.saved);
    } finally {
      setSavingSubsystemId(null);
    }
  };

  const handleSavePeriod = async () => {
    try {
      setSavingPeriod(true);
      const payload = {
        ...periodDraft,
        trimester: periodDraft.trimester === null ? null : Number(periodDraft.trimester),
      };

      if (editingPeriodId) {
        await api.patch(`/core-domain/academic-periods/${editingPeriodId}`, payload);
      } else {
        await api.post("/core-domain/academic-periods", payload);
      }

      toast.success(labels.saved);
      setEditingPeriodId(null);
      setPeriodDraft(blankPeriodDraft);
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || labels.saved);
    } finally {
      setSavingPeriod(false);
    }
  };

  const startEditPeriod = (period: AcademicPeriod) => {
    setEditingPeriodId(period._id);
    setPeriodDraft({
      academicYear: typeof period.academicYear === "string" ? period.academicYear : period.academicYear?._id || "",
      section: typeof period.section === "string" ? period.section : period.section?._id || "",
      type: period.type,
      number: period.number,
      trimester: period.trimester ?? null,
      startDate: toDateInputValue(period.startDate),
      endDate: toDateInputValue(period.endDate),
      isBulletinPeriod: period.isBulletinPeriod,
      isCouncilPeriod: period.isCouncilPeriod,
    });
  };

  const sectionCountLabel = useMemo(() => `${sections.length}`, [sections.length]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{labels.saved}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{labels.title}</h1>
        <p className="text-muted-foreground">{labels.subtitle}</p>
      </div>

      <Tabs defaultValue="school" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="school">{labels.school}</TabsTrigger>
          <TabsTrigger value="sections">{labels.sections} ({sectionCountLabel})</TabsTrigger>
          <TabsTrigger value="subsystems">{labels.subsystems}</TabsTrigger>
          <TabsTrigger value="periods">{labels.periods}</TabsTrigger>
        </TabsList>

        <TabsContent value="school" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{labels.school}</CardTitle>
              <CardDescription>{labels.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{labels.name}</label>
                  <Input value={schoolSettings.schoolName} onChange={(e) => setSchoolSettings({ ...schoolSettings, schoolName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{labels.logo}</label>
                  <Input value={schoolSettings.schoolLogoUrl || ""} onChange={(e) => setSchoolSettings({ ...schoolSettings, schoolLogoUrl: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{labels.motto}</label>
                <Textarea value={schoolSettings.schoolMotto} onChange={(e) => setSchoolSettings({ ...schoolSettings, schoolMotto: e.target.value })} rows={3} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{labels.calendar}</label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={schoolSettings.academicCalendarType} onChange={(e) => setSchoolSettings({ ...schoolSettings, academicCalendarType: e.target.value as SchoolSettings["academicCalendarType"] })}>
                    <option value="trimester">{language === "fr" ? "Trimestre" : "Trimester"}</option>
                    <option value="semester">{language === "fr" ? "Semestre" : "Semester"}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{labels.mode}</label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={schoolSettings.schoolLanguageMode} onChange={(e) => setSchoolSettings({ ...schoolSettings, schoolLanguageMode: e.target.value as SchoolSettings["schoolLanguageMode"], preferredLanguage: e.target.value === "anglophone" ? "en" : schoolSettings.preferredLanguage })}>
                    <option value="francophone">{language === "fr" ? "Francophone" : "Francophone"}</option>
                    <option value="anglophone">{language === "fr" ? "Anglophone" : "Anglophone"}</option>
                    <option value="bilingual">{language === "fr" ? "Bilingue" : "Bilingual"}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{labels.preferredLanguage}</label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={schoolSettings.preferredLanguage} onChange={(e) => setSchoolSettings({ ...schoolSettings, preferredLanguage: e.target.value as SchoolSettings["preferredLanguage"] })} disabled={schoolSettings.schoolLanguageMode !== "bilingual"}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-medium">{labels.cycles}</div>
                <div className="flex flex-wrap gap-3">
                  {cycleOptions.map((cycle) => (
                    <label key={cycle} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={schoolSettings.cycles.includes(cycle)}
                        onChange={(e) =>
                          setSchoolSettings((prev) => ({
                            ...prev,
                            cycles: e.target.checked
                              ? [...prev.cycles, cycle]
                              : prev.cycles.filter((item) => item !== cycle),
                            hasMultipleCycles: e.target.checked ? true : prev.cycles.filter((item) => item !== cycle).length > 1,
                          }))
                        }
                      />
                      {cycle}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{labels.cyclesHint}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="multipleCycles"
                  type="checkbox"
                  checked={schoolSettings.hasMultipleCycles}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, hasMultipleCycles: e.target.checked })}
                />
                <label htmlFor="multipleCycles" className="text-sm">{labels.multipleCycles}</label>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>{labels.attendancePolicy}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={schoolSettings.attendanceLateAsAbsence}
                      onChange={(e) => setSchoolSettings({ ...schoolSettings, attendanceLateAsAbsence: e.target.checked })}
                    />
                    {labels.lateAsAbsence}
                  </label>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={schoolSettings.attendanceExcusedCountsAsAbsence}
                      onChange={(e) => setSchoolSettings({ ...schoolSettings, attendanceExcusedCountsAsAbsence: e.target.checked })}
                    />
                    {labels.excusedAsAbsence}
                  </label>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{labels.councilPolicy}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{labels.decisionMode}</label>
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={schoolSettings.councilDecisionMode} onChange={(e) => setSchoolSettings({ ...schoolSettings, councilDecisionMode: e.target.value as SchoolSettings["councilDecisionMode"] })}>
                      <option value="automatic">Automatic</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{labels.passThreshold}</label>
                    <Input type="number" min={0} max={100} value={schoolSettings.councilPassAverageThreshold} onChange={(e) => setSchoolSettings({ ...schoolSettings, councilPassAverageThreshold: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{labels.maxAbsences}</label>
                    <Input type="number" min={0} value={schoolSettings.councilMaxAbsences} onChange={(e) => setSchoolSettings({ ...schoolSettings, councilMaxAbsences: Number(e.target.value) })} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{labels.bulletinPolicy}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={schoolSettings.bulletinBlockOnUnpaidFees}
                      onChange={(e) => setSchoolSettings({ ...schoolSettings, bulletinBlockOnUnpaidFees: e.target.checked })}
                    />
                    {labels.blockOnUnpaidFees}
                  </label>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{labels.allowedOutstanding}</label>
                    <Input type="number" min={0} value={schoolSettings.bulletinAllowedOutstandingBalance} onChange={(e) => setSchoolSettings({ ...schoolSettings, bulletinAllowedOutstandingBalance: Number(e.target.value) })} />
                  </div>
                </CardContent>
              </Card>
              <Button onClick={handleSchoolSave} disabled={savingSchool}>{savingSchool ? labels.saving : labels.save}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{labels.createSection}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-5">
              <Input placeholder={labels.name} value={sectionDraft.name} onChange={(e) => setSectionDraft({ ...sectionDraft, name: e.target.value })} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={sectionDraft.subSystem} onChange={(e) => setSectionDraft({ ...sectionDraft, subSystem: e.target.value })}>
                <option value="">{labels.subsystems}</option>
                {subsystems.map((subsystem) => (
                  <option key={subsystem._id} value={subsystem._id}>{subsystem.code} - {subsystem.name}</option>
                ))}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={sectionDraft.language} onChange={(e) => setSectionDraft({ ...sectionDraft, language: e.target.value as "fr" | "en" })}>
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={sectionDraft.cycle} onChange={(e) => setSectionDraft({ ...sectionDraft, cycle: e.target.value as SectionDraft["cycle"] })}>
                {cycleOptions.map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
              </select>
              <Button onClick={handleCreateSection}>{labels.createSection}</Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {sections.map((section) => {
              const draft = sectionDrafts[section._id] || blankSectionDraft;
              return (
                <Card key={section._id}>
                  <CardHeader>
                    <CardTitle>{section.name}</CardTitle>
                    <CardDescription>{section.cycle} · {section.language} · {(typeof section.subSystem === "string" ? section.subSystem : section.subSystem?.code) || "-"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={draft.name} onChange={(e) => setSectionDrafts((prev) => ({ ...prev, [section._id]: { ...draft, name: e.target.value } }))} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.subSystem} onChange={(e) => setSectionDrafts((prev) => ({ ...prev, [section._id]: { ...draft, subSystem: e.target.value } }))}>
                        {subsystems.map((subsystem) => (
                          <option key={subsystem._id} value={subsystem._id}>{subsystem.code}</option>
                        ))}
                      </select>
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.language} onChange={(e) => setSectionDrafts((prev) => ({ ...prev, [section._id]: { ...draft, language: e.target.value as "fr" | "en" } }))}>
                        <option value="fr">FR</option>
                        <option value="en">EN</option>
                      </select>
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.cycle} onChange={(e) => setSectionDrafts((prev) => ({ ...prev, [section._id]: { ...draft, cycle: e.target.value as SectionDraft["cycle"] } }))}>
                        {cycleOptions.map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.isActive} onChange={(e) => setSectionDrafts((prev) => ({ ...prev, [section._id]: { ...draft, isActive: e.target.checked } }))} />
                      {labels.active}
                    </label>
                    <Button onClick={() => handleUpdateSection(section._id)} disabled={savingSectionId === section._id}>{savingSectionId === section._id ? labels.saving : labels.editSection}</Button>
                  </CardContent>
                </Card>
              );
            })}
            {sections.length === 0 ? <div className="text-sm text-muted-foreground">{labels.noSections}</div> : null}
          </div>
        </TabsContent>

        <TabsContent value="subsystems" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{labels.createSubsystem}</CardTitle>
              <CardDescription>{labels.bulletinTemplateHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSyncSubsystems} disabled={syncingSubsystems}>{syncingSubsystems ? labels.saving : labels.createSubsystem}</Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {subsystems.map((subsystem) => {
              const draft = subsystemDrafts[subsystem._id] || {
                name: subsystem.name,
                gradingScale: subsystem.gradingScale,
                periodType: subsystem.periodType,
                hasCoefficientBySubject: subsystem.hasCoefficientBySubject,
                passThreshold: subsystem.passThreshold,
                bulletinTemplate: subsystem.bulletinTemplate || "",
                isActive: subsystem.isActive,
              };
              return (
                <Card key={subsystem._id}>
                  <CardHeader>
                    <CardTitle>{subsystem.code}</CardTitle>
                    <CardDescription>{subsystem.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={draft.name} onChange={(e) => setSubsystemDrafts((prev) => ({ ...prev, [subsystem._id]: { ...draft, name: e.target.value } }))} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.gradingScale} onChange={(e) => setSubsystemDrafts((prev) => ({ ...prev, [subsystem._id]: { ...draft, gradingScale: e.target.value as SubSystemDraft["gradingScale"] } }))}>
                        {gradingScales.map((scale) => <option key={scale} value={scale}>{scale}</option>)}
                      </select>
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.periodType} onChange={(e) => setSubsystemDrafts((prev) => ({ ...prev, [subsystem._id]: { ...draft, periodType: e.target.value as SubSystemDraft["periodType"] } }))}>
                        {periodTypes.map((periodType) => <option key={periodType} value={periodType}>{periodType}</option>)}
                      </select>
                    </div>
                    <Input type="number" min={0} max={20} value={draft.passThreshold} onChange={(e) => setSubsystemDrafts((prev) => ({ ...prev, [subsystem._id]: { ...draft, passThreshold: Number(e.target.value) } }))} />
                    <Input placeholder={labels.bulletinTemplate} value={draft.bulletinTemplate} onChange={(e) => setSubsystemDrafts((prev) => ({ ...prev, [subsystem._id]: { ...draft, bulletinTemplate: e.target.value } }))} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.hasCoefficientBySubject} onChange={(e) => setSubsystemDrafts((prev) => ({ ...prev, [subsystem._id]: { ...draft, hasCoefficientBySubject: e.target.checked } }))} />
                      {labels.coefficientMode}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.isActive} onChange={(e) => setSubsystemDrafts((prev) => ({ ...prev, [subsystem._id]: { ...draft, isActive: e.target.checked } }))} />
                      {labels.active}
                    </label>
                    <Button onClick={() => handleUpdateSubsystem(subsystem._id)} disabled={savingSubsystemId === subsystem._id}>{savingSubsystemId === subsystem._id ? labels.saving : labels.editSubsystem}</Button>
                  </CardContent>
                </Card>
              );
            })}
            {subsystems.length === 0 ? <div className="text-sm text-muted-foreground">{labels.noSubsystems}</div> : null}
          </div>
        </TabsContent>

        <TabsContent value="periods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{editingPeriodId ? labels.updatePeriod : labels.createPeriod}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={periodDraft.academicYear} onChange={(e) => setPeriodDraft({ ...periodDraft, academicYear: e.target.value })}>
                  <option value="">{labels.academicYear}</option>
                  {academicYears.map((year) => (
                    <option key={year._id} value={year._id}>{year.name}</option>
                  ))}
                </select>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={periodDraft.section} onChange={(e) => setPeriodDraft({ ...periodDraft, section: e.target.value })}>
                  <option value="">{labels.section}</option>
                  {sections.map((section) => (
                    <option key={section._id} value={section._id}>{section.name}</option>
                  ))}
                </select>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={periodDraft.type} onChange={(e) => setPeriodDraft({ ...periodDraft, type: e.target.value as PeriodDraft["type"] })}>
                  {periodKindOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <Input type="number" min={1} max={12} value={periodDraft.number} onChange={(e) => setPeriodDraft({ ...periodDraft, number: Number(e.target.value) })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input type="date" value={periodDraft.startDate} onChange={(e) => setPeriodDraft({ ...periodDraft, startDate: e.target.value })} />
                <Input type="date" value={periodDraft.endDate} onChange={(e) => setPeriodDraft({ ...periodDraft, endDate: e.target.value })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input type="number" min={1} max={3} placeholder={labels.trimester} value={periodDraft.trimester ?? ""} onChange={(e) => setPeriodDraft({ ...periodDraft, trimester: e.target.value ? Number(e.target.value) : null })} />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={periodDraft.isBulletinPeriod} onChange={(e) => setPeriodDraft({ ...periodDraft, isBulletinPeriod: e.target.checked })} />
                    {labels.bulletinPeriod}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={periodDraft.isCouncilPeriod} onChange={(e) => setPeriodDraft({ ...periodDraft, isCouncilPeriod: e.target.checked })} />
                    {labels.councilPeriod}
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSavePeriod} disabled={savingPeriod || !periodDraft.academicYear || !periodDraft.section || !periodDraft.startDate || !periodDraft.endDate}>
                  {savingPeriod ? labels.saving : editingPeriodId ? labels.updatePeriod : labels.createPeriod}
                </Button>
                {editingPeriodId ? (
                  <Button variant="outline" onClick={() => { setEditingPeriodId(null); setPeriodDraft(blankPeriodDraft); }}>
                    {language === "fr" ? "Annuler" : "Cancel"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {periods.map((period) => (
              <Card key={period._id}>
                <CardHeader>
                  <CardTitle>{period.type} {period.number}</CardTitle>
                  <CardDescription>
                    {typeof period.section === "string" ? period.section : period.section?.name} · {typeof period.academicYear === "string" ? period.academicYear : period.academicYear?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>{labels.bulletinPeriod}: {period.isBulletinPeriod ? "yes" : "no"}</div>
                  <div>{labels.councilPeriod}: {period.isCouncilPeriod ? "yes" : "no"}</div>
                  <div>{labels.startDate}: {toDateInputValue(period.startDate)}</div>
                  <div>{labels.endDate}: {toDateInputValue(period.endDate)}</div>
                  <Button variant="outline" onClick={() => startEditPeriod(period)}>{labels.openEdit}</Button>
                </CardContent>
              </Card>
            ))}
            {periods.length === 0 ? <div className="text-sm text-muted-foreground">{labels.noPeriods}</div> : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
