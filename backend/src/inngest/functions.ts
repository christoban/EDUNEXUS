import { inngest } from "./index.ts";
import Class from "../models/class.ts";
import User from "../models/user.ts";
import Timetable from "../models/timetable.ts";
import TimetableGeneration from "../models/timetableGeneration.ts";
import ExamGeneration from "../models/examGeneration.ts";
import Exam from "../models/exam.ts";
import Submission from "../models/submission.ts";

import { NonRetriableError } from "inngest";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

interface GenSettings {
  startTime: string;
  endTime: string;
  periodsPerDay: number;
  teachingDays: string[];
  periods?: number;
  lunchBreakMinutes?: number;
  periodDuration?: number;
}

interface TimeSlot {
  kind: "class" | "break";
  startTime: string;
  endTime: string;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const toTime = (value: number) => {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const buildDailyTimeSlots = (settings: GenSettings): TimeSlot[] => {
  const start = toMinutes(settings.startTime);
  const end = toMinutes(settings.endTime);
  const periods = settings.periodsPerDay;
  const lunchBreak = periods > 1 ? settings.lunchBreakMinutes ?? 60 : 0;
  const totalMinutes = end - start;
  const teachingMinutes = totalMinutes - lunchBreak;

  if (teachingMinutes <= 0) {
    throw new NonRetriableError("Invalid time range for timetable generation");
  }

  const basePeriodDuration = Math.floor(teachingMinutes / periods);
  const remainder = teachingMinutes % periods;
  const lunchAfterIndex = Math.ceil(periods / 2);

  const slots: TimeSlot[] = [];
  let cursor = start;
  for (let i = 0; i < periods; i++) {
    const duration = basePeriodDuration + (i < remainder ? 1 : 0);
    const slotStart = cursor;
    const slotEnd = slotStart + duration;

    slots.push({
      kind: "class",
      startTime: toTime(slotStart),
      endTime: toTime(slotEnd),
    });

    cursor = slotEnd;
    if (i + 1 === lunchAfterIndex && lunchBreak > 0) {
      const breakStart = cursor;
      cursor += lunchBreak;
      slots.push({
        kind: "break",
        startTime: toTime(breakStart),
        endTime: toTime(cursor),
      });
    }
  }

  return slots;
};

const normalizeSchedule = (rawSchedule: any, settings: GenSettings) => {
  const rawDays = Array.isArray(rawSchedule?.schedule) ? rawSchedule.schedule : [];

  const assignmentPool = rawDays
    .flatMap((day: any) => (Array.isArray(day?.periods) ? day.periods : []))
    .map((period: any) => ({
      subject: period?.subject,
      teacher: period?.teacher,
    }))
    .filter((period: any) => period.subject && period.teacher);

  if (assignmentPool.length === 0) {
    throw new NonRetriableError("AI generated no valid subject/teacher assignments");
  }

  const dailySlots = buildDailyTimeSlots(settings);
  let assignmentIndex = 0;

  const schedule = settings.teachingDays.map((day) => {
    const periods = dailySlots.map((slot) => {
      if (slot.kind === "break") {
        return {
          kind: "break",
          subject: null,
          teacher: null,
          startTime: slot.startTime,
          endTime: slot.endTime,
        };
      }

      const assignment = assignmentPool[assignmentIndex % assignmentPool.length];
      assignmentIndex += 1;
      return {
        kind: "class",
        subject: assignment.subject,
        teacher: assignment.teacher,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
    });

    return { day, periods };
  });

  return { schedule };
};

// Your new function:
export const generateTimeTable = inngest.createFunction(
  { id: "Generate-Timetable", triggers: [{ event: "generate/timetable" }] },
  async ({ event, step }) => {
    const { classId, academicYearId, settings } = event.data as {
      classId: string;
      academicYearId: string;
      settings: GenSettings;
      generationId?: string;
    };

    const updateGenerationStatus = async (
      status: "running" | "completed" | "failed",
      message?: string,
      timetableId?: string
    ) => {
      if (!event.data.generationId) return;
      await TimetableGeneration.findByIdAndUpdate(event.data.generationId, {
        status,
        message,
        timetable: timetableId || null,
      });
    };

    try {
      await updateGenerationStatus("running", "Generation started");

      const contextData = await step.run("fetch-class-context", async () => {
        // fetch class
        const classData = await Class.findById(classId).populate("subjects");
        if (!classData) throw new NonRetriableError("Class not found");

        // fetch teachers
        const allTeacher = await User.find({ role: "teacher" });

        // filter qualified teachers for class subjects
        const classSubjectsIds = classData.subjects.map((sub) =>
          sub._id.toString()
        );

        const qualifiedTeachers = allTeacher
          .filter((teacher) => {
            if (!teacher.teacherSubject) return false;
            return teacher.teacherSubject.some((subId) =>
              classSubjectsIds.includes(subId.toString())
            );
          })
          .map((tea) => ({
            id: tea._id,
            name: tea.name,
            subjects: tea.teacherSubject,
          }));

        const subjectsPayload = classData.subjects.map((sub: any) => ({
          id: sub._id,
          name: sub.name,
          code: sub.code,
        }));

        // here we should check if we have teachers and subjects
        if (subjectsPayload.length === 0 || qualifiedTeachers.length === 0)
          throw new NonRetriableError(
            "No Subjects or Teachers assigned to this class"
          );

        return {
          className: classData.name,
          subjects: subjectsPayload,
          teachers: qualifiedTeachers,
        };
      });

    // generate timetable logic would go here
      const aiSchedule = await step.run("generate-timetable-logic", async () => {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) {
        throw new NonRetriableError("GOOGLE_GENERATIVE_AI_API_KEY is missing");
      }

      const allTimetables = await Timetable.find({
        academicYear: academicYearId,
      });

      const prompt = `
        You are a school scheduler. Generate a weekly timetable.

        CONTEXT:
        - Class: ${contextData.className}
        - Hours: ${settings.startTime} to ${settings.endTime} (${
        settings.periodsPerDay
      } periods/day).
        - Teaching days: ${settings.teachingDays.join(", ")}

        RESOURCES:
        - Subjects: ${JSON.stringify(contextData.subjects)}
        - Teachers: ${JSON.stringify(contextData.teachers)}
        - Other Timetables: ${JSON.stringify(allTimetables)}

        STRICT RULES:
        1. Generate EXACTLY ${settings.periodsPerDay} periods per listed teaching day.
        2. Use ONLY these days: ${settings.teachingDays.join(", ")}.
        3. Every period must stay within ${settings.startTime} and ${settings.endTime}.
        4. Assign a Teacher to every Subject period.
        5. Teacher MUST have the subject ID in their list.
        6. Avoid clashes with other classes(teacher can't be in two classes at the same time).
        7. Keep the output strict JSON only.
        8. Include every selected teaching day exactly once.

        OUTPUT SCHEMA:
        {
          "schedule": [
            {
              "day": "Monday",
              "periods": [
                { "subject": "SUBJECT_ID", "teacher": "TEACHER_ID", "startTime": "HH:MM", "endTime": "HH:MM" }
              ]
            }
          ]
        }
      `;

      const google = createGoogleGenerativeAI({
        apiKey,
      });

      // I will show you how to get one if these does not work for you
      const activeModel = google("gemini-3-flash-preview");

      const { text } = await generateText({
        prompt,
        model: activeModel,
      });

      const cleanJSON = text.replace(/```json/g, "").replace(/```/g, "");
        const parsed = JSON.parse(cleanJSON);
        return normalizeSchedule(parsed, settings);
      });
      // now let save
      const savedTimetable = await step.run("save-timetable", async () => {
        // Delete existing to avoid duplicates
        // we should also delete any timetable assigned or generate for these class
        await Timetable.findOneAndDelete({
          class: classId,
          academicYear: academicYearId,
        });
        const timetable = await Timetable.create({
          class: classId,
          academicYear: academicYearId,
          schedule: aiSchedule.schedule,
        });

        return timetable;
      });

      await updateGenerationStatus(
        "completed",
        "Timetable generated successfully",
        savedTimetable._id.toString()
      );
      return { message: "Timetable generated successfully" };
    } catch (error: any) {
      await updateGenerationStatus(
        "failed",
        error?.message || "Timetable generation failed"
      );
      throw error;
    }
  }
);

// Your new function:
export const generateExam = inngest.createFunction(
  { id: "Generate-Exam", triggers: [{ event: "exam/generate" }] },
  async ({ event, step }) => {
    const { examId, generationId, topic, subjectName, difficulty, count } =
      event.data;

    const updateExamGenerationStatus = async (
      status: "running" | "completed" | "failed",
      message?: string
    ) => {
      if (!generationId) return;
      await ExamGeneration.findByIdAndUpdate(generationId, {
        status,
        message,
      });
    };

    try {
      await updateExamGenerationStatus("running", "Exam generation in progress");

      // generate timetable logic would go here
      const aiExam = await step.run("generate-exam-logic", async () => {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
          throw new NonRetriableError("GOOGLE_GENERATIVE_AI_API_KEY is missing");
        }

      const prompt = `
        You are a strict teacher. Create a JSON array of ${count} multiple-choice questions for a high school exam.

        CONTEXT:
        - Subject: ${subjectName}
        - Topic: ${topic}
        - Difficulty: ${difficulty}

        STRICT JSON SCHEMA (Array of Objects):
        [
          {
            "questionText": "Question string",
            "type": "MCQ",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "The exact string of the correct option",
            "points": 1
          }
        ]

        RULES:
        1. Output ONLY raw JSON. No Markdown.
        2. Ensure correct answer matches one of the options exactly.
      `;

        const google = createGoogleGenerativeAI({
          apiKey,
        });

        // I will show you how to get one if these does not work for you
        const activeModel = google("gemini-3-flash-preview");

        const { text } = await generateText({
          prompt,
          model: activeModel,
        });

        // Sanitize JSON
        const cleanJson = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        return JSON.parse(cleanJson);
      });
      // now let save
      await step.run("save-exam", async () => {
        const exam = await Exam.findById(examId);

        if (!exam) {
          throw new NonRetriableError(`Exam ${examId} not found`);
        }

        // Update the exam with the new questions
        exam.questions = aiExam;
        exam.isActive = false; // Keep it inactive until teacher reviews it

        await exam.save();

        return { success: true, count: aiExam.length };
      });
      await updateExamGenerationStatus(
        "completed",
        "Exam generated successfully"
      );
      return { message: "Exam generated successfully" };
    } catch (error: any) {
      await updateExamGenerationStatus(
        "failed",
        error?.message || "Exam generation failed"
      );
      throw error;
    }
  }
);

// handle submission inside inngest
// Important because we don't want the student's submission to be have issues
// with server timeouts or other problems
export const handleExamSubmission = inngest.createFunction(
  { id: "Handle-Exam-Submission", triggers: [{ event: "exam/submit" }] },
  async ({ event, step }) => {
    const { examId, studentId, answers } = event.data;

    await step.run("process-exam-submission", async () => {
      // 1. Check if already submitted
      const existingSubmission = await Submission.findOne({
        exam: examId,
        student: studentId,
      });
      if (existingSubmission) {
        throw new NonRetriableError("Exam already submitted");
      }

      // 2. Fetch full exam (with answers)
      const exam = await Exam.findById(examId).select(
        "+questions.correctAnswer"
      );
      if (!exam) {
        throw new NonRetriableError(`Exam ${examId} not found`);
      }

      // 3. Calculate Score
      let score = 0;
      let totalPoints = 0;

      exam.questions.forEach((question) => {
        totalPoints += question.points;
        const studentAns = answers.find(
          (a: any) => a.questionId === question._id.toString()
        );
        if (studentAns && studentAns.answer === question.correctAnswer) {
          score += question.points;
        }
      });

      // 4. Save Submission
      await Submission.create({
        exam: examId,
        student: studentId,
        answers,
        score,
      });
    });
    return { message: "Exam submitted successfully" };
  }
);