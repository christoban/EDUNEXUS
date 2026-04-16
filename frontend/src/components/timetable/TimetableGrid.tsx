import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Clock, User as UserIcon } from "lucide-react";
import type { schedule } from "@/types";
import { t } from "@/lib/i18n";
import type { UILanguage } from "@/hooks/useUILanguage";

interface Props {
  schedule: schedule[];
  isLoading: boolean;
  language: UILanguage;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const TimetableGrid = ({ schedule, isLoading, language }: Props) => {
  const timeSlots = useMemo(() => {
    if (!schedule?.length) return [];

    const times = new Set<string>();
    schedule.forEach((day) => {
      day.periods.forEach((period) => {
        times.add(period.startTime);
      });
    });

    return Array.from(times).sort((left, right) => toMinutes(left) - toMinutes(right));
  }, [schedule]);

  const teachingDaySet = useMemo(
    () => new Set(schedule.map((day) => day.day)),
    [schedule]
  );

  const getRowLabel = (startTime: string) => {
    for (const day of schedule) {
      const found = day.periods.find((p) => p.startTime === startTime);
      if (found) {
        return `${found.startTime} - ${found.endTime}`;
      }
    }

    return startTime;
  };

  // loading
  if (isLoading) {
    return (
      <div className="h-125 w-full flex items-center justify-center border rounded-lg bg-card">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">{t("timetable.grid.loading", language)}</p>
        </div>
      </div>
    );
  }

  // no schedule
  if (!schedule || schedule.length === 0) {
    return (
      <div className="h-100 w-full flex flex-col items-center justify-center border rounded-lg border-dashed bg-card">
        <Clock className="h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="font-semibold text-lg">{t("timetable.grid.none", language)}</h3>
        <p className="text-muted-foreground text-sm max-w-sm text-center">
          {t("timetable.grid.noneDescription", language)}
        </p>
      </div>
    );
  }
  // now fix the design, next we can have generate and test
  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
      <div className="flex w-max min-w-full flex-col">
        {/* header row */}
        <div className="flex border-b bg-muted/50">
          <div className="w-32 shrink-0 border-r p-4 font-medium text-muted-foreground flex items-center justify-center">
            {t("timetable.grid.time", language)}
          </div>
          {DAYS.map((day) => (
            <div
              key={day}
              className="flex-1 min-w-50 border-r p-4 font-semibold text-center last:border-r-0"
            >
              {t(`weekday.${day}`, language)}
            </div>
          ))}
        </div>
        {timeSlots?.map((time) => (
          <div className="flex border-b last:border-b-0 min-h-27.5" key={time}>
            <div className="w-32 shrink-0 border-r p-2 text-xs font-medium text-muted-foreground flex items-center justify-center text-center bg-muted/50">
              {getRowLabel(time)}
            </div>
            {DAYS.map((day) => {
              // Find the day data
              const dayData = schedule.find((d) => d.day === day);
              const isTeachingDay = teachingDaySet.has(day);

              // Find the specific period that matches THIS ROW'S start time
              const period = dayData?.periods.find((p) => p.startTime === time);
              return (
                <div
                  key={`${day}-${time}`}
                  className="flex-1 min-w-50 border-r p-2 last:border-r-0"
                >
                  {/* make sure you have subject and teacher */}
                  {period?.kind === "break" ? (
                    <div className="h-full w-full rounded-md border border-amber-800 bg-amber-900 flex items-center justify-center dark:border-amber-300 dark:bg-amber-100">
                      <span className="text-xs font-semibold text-amber-100 dark:text-amber-900">
                        {t("timetable.grid.break", language)}
                      </span>
                    </div>
                  ) : period && period.subject && period.teacher ? (
                    <div className="h-full w-full rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-2 border-l-4 border-l-primary">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant="outline"
                            className="font-bold text-[10px] px-1.5"
                          >
                            {period.subject.code && period.subject.code}
                          </Badge>
                          {/* Redundant time check inside card removed for cleaner look, 
                                  since it's already in the row header */}
                        </div>
                        <h4 className="font-semibold text-sm leading-tight text-primary line-clamp-2">
                          {period.subject.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-2 border-t border-dashed">
                        <UserIcon className="h-3 w-3 shrink-0" />
                        <span
                          className="truncate max-w-35"
                          title={period.teacher.name}
                        >
                          {period.teacher.name}
                        </span>
                      </div>
                    </div>
                  ) : !isTeachingDay ? (
                    <div className="h-full w-full rounded-md border border-slate-700 bg-slate-800 dark:border-slate-300 dark:bg-slate-200/80" />
                  ) : (
                    <div className="h-full w-full rounded-md border border-dashed border-primary/40 bg-primary/15 dark:border-primary/80 dark:bg-primary/35 flex items-center justify-center">
                      <span className="text-xs text-primary-foreground/90 dark:text-primary font-semibold">
                        {t("timetable.grid.freePeriod", language)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default TimetableGrid;
