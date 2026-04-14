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

const Timetable = () => {
  const { user } = useAuth();
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

  // fetch timetable
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
          // Only show toast if user isn't admin (admins expect empty on new classes)
          toast("No schedule found for this class", { icon: "📅" });
        }
      } else {
        toast.error("Failed to load timetable");
      }
    } finally {
      setLoadingSchedule(false);
    }
  };

  // auto fetch using useEffect
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
          toast.success(generation.message || "Timetable generated successfully");
          return;
        }

        if (generation.status === "failed") {
          setGenerationProgress(0);
          if (generationIntervalRef.current) {
            window.clearInterval(generationIntervalRef.current);
          }
          toast.error(
            generation.message || "Timetable generation failed"
          );
        }
      } catch (error: any) {
        if (generationIntervalRef.current) {
          window.clearInterval(generationIntervalRef.current);
        }
        setGenerationStatus("failed");
        setGenerationProgress(0);
        toast.error(
          error.response?.data?.message || "Failed to check generation status"
        );
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
      setGenerationMessage(data.message || "Timetable generation initiated");
      setGenerationProgress(20);
      toast.success(data.message || "AI Generation Started");
      startPollingGeneration(data.generationId, selectedClass);
    } catch (error: any) {
      const message = error.response?.data?.message || "Generation failed";
      setGenerationStatus("failed");
      setGenerationMessage(message);
      setGenerationProgress(0);
      toast.error(message);
    }
  };

  const isGenerating = generationStatus === "queued" || generationStatus === "running";
  //   console.log("class timetable:", scheduleData);
  //   console.log("selected class:", selectedClass);
  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Timetable Management
        </h1>
        <p className="text-muted-foreground">
          {isStudent
            ? "View your weekly class schedule."
            : "View or manage weekly schedules."}
        </p>
      </div>
      {!isStudent && (
        <GeneratorControls
          onGenerate={handleGenerate}
          onClassChange={fetchTimetable}
          isGenerating={isGenerating}
          selectedClass={selectedClass}
          setSelectedClass={setSelectedClass}
        />
      )}
      {generationStatus !== "idle" && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium capitalize">
                {generationStatus === "queued"
                  ? "Queued"
                  : generationStatus === "running"
                  ? "Generating"
                  : generationStatus === "completed"
                  ? "Completed"
                  : "Failed"}
              </span>
              <span className="text-muted-foreground">
                {generationMessage || "Preparing timetable generation..."}
              </span>
            </div>
            <Progress value={generationProgress} />
          </CardContent>
        </Card>
      )}
      <TimetableGrid schedule={scheduleData} isLoading={loadingSchedule} />
    </div>
  );
};

export default Timetable;
