import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/AuthProvider";
import type { schedule } from "@/types";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import GeneratorControls, {
  type GenSettings,
} from "@/components/timetable/GeneratorControls";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import { useUILanguage } from "@/hooks/useUILanguage";
import { t } from "@/lib/i18n";

const Timetable = () => {
  const { user } = useAuth();
  const language = useUILanguage();
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";

  const [scheduleData, setScheduleData] = useState<schedule[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [generationStatus, setGenerationStatus] = useState<
    "idle" | "queued" | "running" | "completed" | "failed"
  >("idle");
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const generationIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStudent && user?.studentClass) {
      const classId =
        typeof user.studentClass === "object" ? user.studentClass._id : user.studentClass;
      if (classId && classId !== selectedClass) {
        setSelectedClass(classId);
      }
    }
  }, [isStudent, user, selectedClass]);

  const fetchTimetable = async (classId: string) => {
    if (!classId) return;

    try {
      setLoadingSchedule(true);
      const { data } = await api.get(`/timetables/${classId}`);
      setScheduleData(data.schedule || []);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        setScheduleData([]);
        if (!isAdmin) {
          toast(t("timetable.defaultNoSchedule", language), { icon: "📅" });
        }
      } else {
        toast.error(t("timetable.error.load", language));
      }
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    if (selectedClass) {
      fetchTimetable(selectedClass);
    }
  }, [selectedClass]);

  useEffect(() => {
    return () => {
      if (generationIntervalRef.current) {
        window.clearInterval(generationIntervalRef.current);
      }
    };
  }, []);

  const startPollingGeneration = (generationId: string, classId: string) => {
    if (generationIntervalRef.current) {
      window.clearInterval(generationIntervalRef.current);
    }

    const poll = async () => {
      try {
        const { data } = await api.get(`/timetables/generation/${generationId}`);
        const generation = data.generation;
        setGenerationStatus(generation.status);
        setGenerationMessage(generation.message || "");

        if (generation.status === "running") {
          setGenerationProgress(55);
          return;
        }

        if (generation.status === "queued") {
          setGenerationProgress(20);
          return;
        }

        if (generation.status === "completed") {
          setGenerationProgress(100);
          if (generationIntervalRef.current) {
            window.clearInterval(generationIntervalRef.current);
          }
          await fetchTimetable(classId);
          toast.success(generation.message || t("timetable.defaultGenerationSuccess", language));
          return;
        }

        if (generation.status === "failed") {
          setGenerationProgress(0);
          if (generationIntervalRef.current) {
            window.clearInterval(generationIntervalRef.current);
          }
          toast.error(generation.message || t("timetable.error.generation", language));
        }
      } catch (error: any) {
        if (generationIntervalRef.current) {
          window.clearInterval(generationIntervalRef.current);
        }
        setGenerationStatus("failed");
        setGenerationProgress(0);
        toast.error(error.response?.data?.message || t("timetable.error.checkStatus", language));
      }
    };

    void poll();
    generationIntervalRef.current = window.setInterval(poll, 3000);
  };

  const handleGenerate = async (
    selectedClass: string,
    yearId: string,
    settings: GenSettings
  ) => {
    try {
      const { data } = await api.post("/timetables/generate", {
        classId: selectedClass,
        academicYearId: yearId,
        settings,
      });

      setGenerationStatus(data.status || "queued");
      setGenerationMessage(data.message || t("timetable.defaultQueued", language));
      setGenerationProgress(20);
      toast.success(data.message || t("timetable.defaultGenerationStarted", language));
      startPollingGeneration(data.generationId, selectedClass);
    } catch (error: any) {
      const message = error.response?.data?.message || t("timetable.error.generation", language);
      setGenerationStatus("failed");
      setGenerationMessage(message);
      setGenerationProgress(0);
      toast.error(message);
    }
  };

  const isGenerating = generationStatus === "queued" || generationStatus === "running";

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("timetable.title", language)}
        </h1>
        <p className="text-muted-foreground">
          {isStudent
            ? t("timetable.subtitle.student", language)
            : t("timetable.subtitle.manager", language)}
        </p>
      </div>
      {!isStudent && (
        <GeneratorControls
          onGenerate={handleGenerate}
          onClassChange={fetchTimetable}
          isGenerating={isGenerating}
          selectedClass={selectedClass}
          setSelectedClass={setSelectedClass}
          language={language}
        />
      )}
      {generationStatus !== "idle" && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium capitalize">
                {generationStatus === "queued"
                  ? t("timetable.status.queued", language)
                  : generationStatus === "running"
                    ? t("timetable.status.running", language)
                    : generationStatus === "completed"
                      ? t("timetable.status.completed", language)
                      : t("timetable.status.failed", language)}
              </span>
              <span className="text-muted-foreground">
                {generationMessage || t("timetable.defaultPreparing", language)}
              </span>
            </div>
            <Progress value={generationProgress} />
          </CardContent>
        </Card>
      )}
      <TimetableGrid schedule={scheduleData} isLoading={loadingSchedule} language={language} />
    </div>
  );
};

export default Timetable;
