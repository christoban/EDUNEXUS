import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react"; // Added Search icon
import { api } from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { academicYear, Class } from "@/types";
import { useAuth } from "@/hooks/AuthProvider";
import { t } from "@/lib/i18n";
import type { UILanguage } from "@/hooks/useUILanguage";

export interface GenSettings {
  startTime: string;
  endTime: string;
  periodsPerDay: number;
  teachingDays: string[];
  periods?: number;
}

const TEACHING_DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const CLASS_FETCH_LIMIT = 100;

interface Props {
  onGenerate: (
    classId: string,
    yearId: string,
    settings: GenSettings
  ) => Promise<void>;
  onClassChange: (classId: string) => void;
  isGenerating: boolean;
  selectedClass: string;
  setSelectedClass: (classId: string) => void;
  language: UILanguage;
}
const GeneratorControls = ({
  onGenerate,
  onClassChange,
  isGenerating,
  selectedClass,
  setSelectedClass,
  language,
}: Props) => {
  const { user } = useAuth();
  const hideGenerate = user?.role !== "admin";
  const isParent = user?.role === "parent";
  const [classes, setClasses] = useState<Class[]>([]);
  const [years, setYears] = useState<academicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  // Time Settings
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("14:00");
  const [periodsPerDay, setPeriodsPerDay] = useState("5");
  const [teachingDays, setTeachingDays] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        // Timetable class selector must load all classes, not only the API default first page.
        const allClasses: Class[] = [];
        let page = 1;
        let totalPages = 1;

        do {
          const clsRes = await api.get(`/classes?page=${page}&limit=${CLASS_FETCH_LIMIT}`);
          const pageClasses = Array.isArray(clsRes.data?.classes)
            ? clsRes.data.classes
            : [];
          allClasses.push(...pageClasses);
          totalPages = Number(clsRes.data?.pagination?.pages || 1);
          page += 1;
        } while (page <= totalPages);

        const yearRes = isParent
          ? await api.get("/academic-years/current")
          : await api.get("/academic-years?page=1&limit=100"); // Get years so we can see history if needed

        setClasses(allClasses);
        setYears(Array.isArray(yearRes.data?.years) ? yearRes.data.years : [yearRes.data]);

        // Auto-select current year
        const currentYears = Array.isArray(yearRes.data?.years)
          ? yearRes.data.years
          : [yearRes.data];
        const current = currentYears.find((y: academicYear) => y.isCurrent);

        if (current?._id) setSelectedYear(current._id);
      } catch (error) {
        toast.error(t("timetable.error.loadSelection", language));
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const handleGenerateClick = () => {
    if (!selectedClass || !selectedYear) {
      toast.error(t("timetable.error.selectClassYear", language));
      return;
    }

    if (teachingDays.length === 0) {
      toast.error(t("timetable.error.selectTeachingDay", language));
      return;
    }

    const parsedPeriods = parseInt(periodsPerDay, 10) || 5;

    onGenerate(selectedClass, selectedYear, {
      startTime,
      endTime,
      periodsPerDay: parsedPeriods,
      teachingDays,
      periods: parsedPeriods,
    });
  };

  const toggleTeachingDay = (day: string, checked: boolean) => {
    setTeachingDays((prev) => {
      if (checked) {
        if (prev.includes(day)) return prev;
        return [...prev, day];
      }
      return prev.filter((item) => item !== day);
    });
  };

  const weeklyTotal = teachingDays.length * (parseInt(periodsPerDay, 10) || 0);

  const handleClassSelect = (val: string) => {
    setSelectedClass(val);
    onClassChange(val);
  };
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {hideGenerate ? t("timetable.viewOnlyTitle", language) : t("timetable.controlsTitle", language)}
            </CardTitle>
            <CardDescription>
              {hideGenerate
                ? t("timetable.viewOnlyDescription", language)
                : t("timetable.controlsDescription", language)}
            </CardDescription>
          </div>
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("timetable.aiThinking", language)}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("timetable.academicYear", language)}</Label>
            <Select
              value={selectedYear}
              onValueChange={setSelectedYear}
              disabled={loadingData}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("timetable.selectYear", language)} />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y._id} value={y._id}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("timetable.class", language)}</Label>
            <Select
              value={selectedClass}
              onValueChange={handleClassSelect}
              disabled={loadingData}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("timetable.selectClass", language)} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!hideGenerate && (
          <>
            <div className="grid grid-cols-3 gap-4 border-t pt-4 mt-4">
              <div className="space-y-2">
                <Label>{t("timetable.startTime", language)}</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("timetable.endTime", language)}</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("timetable.periodsPerDay", language)}</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={periodsPerDay}
                  onChange={(e) => setPeriodsPerDay(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div className="space-y-3 border-t pt-4 mt-4">
              <Label>{t("timetable.teachingDays", language)}</Label>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {TEACHING_DAY_OPTIONS.map((day) => {
                  const checked = teachingDays.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex items-center gap-2 text-sm border rounded-md px-3 py-2"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleTeachingDay(day, value === true)
                        }
                        disabled={isGenerating}
                      />
                      <span>{t(`weekday.${day}`, language)}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("timetable.weeklyTotal", language)}: {weeklyTotal} {t("timetable.periods", language)} ({teachingDays.length} {t("timetable.days", language)} x{" "}
                {parseInt(periodsPerDay, 10) || 0} {t("timetable.periodsPerDay", language).toLowerCase()})
              </p>
            </div>

            <Button
              className="w-full mt-2"
              onClick={handleGenerateClick}
              disabled={isGenerating || !selectedClass || !selectedYear}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("timetable.optimizing", language)}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> {t("timetable.generateWithAI", language)}
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GeneratorControls;
