import "dotenv/config";
import mongoose from "mongoose";

import { connectDB } from "../config/db.ts";
import AcademicYear from "../models/academicYear.ts";
import User from "../models/user.ts";
import Subject from "../models/subject.ts";
import Class from "../models/class.ts";
import Exam from "../models/exam.ts";
import Submission from "../models/submission.ts";
import Attendance from "../models/attendance.ts";
import ActivityLog from "../models/activitieslog.ts";
import Grade from "../models/grade.ts";
import ReportCard from "../models/reportCard.ts";
import { getMentionFromAverage } from "../utils/reporting.ts";

const mkDate = (value: string) => new Date(value);
const asId = (value: any) => String(value?._id || value);
const seededPassword = "password123";

type ReportPeriod = "term1" | "term2" | "term3" | "annual";

const pickPeriodByMonth = (month: number): ReportPeriod => {
  if (month >= 9 && month <= 12) return "term1";
  if (month >= 1 && month <= 3) return "term2";
  if (month >= 4 && month <= 6) return "term3";
  return "annual";
};

const createDeterministicRng = (seed = 123456789) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const shuffled = <T,>(items: T[], rng: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = temp;
  }
  return copy;
};

const buildFamilySizes = (targetStudents: number): number[] => {
  const familySizes: number[] = [];
  let remaining = targetStudents;

  while (remaining > 0) {
    const childrenCount =
      remaining >= 3
        ? familySizes.length % 10 < 2
          ? 3
          : familySizes.length % 10 < 6
            ? 2
            : 1
        : remaining;

    familySizes.push(Math.min(childrenCount, remaining));
    remaining -= Math.min(childrenCount, remaining);
  }

  return familySizes;
};

const getClassSubjectCodes = (className: string): string[] => {
  const [grade, stream] = className.split(" ");

  const common = ["MATH-SEC", "FREN-SEC", "ENG-SEC", "HIST-SEC", "GEOG-SEC", "PE-SEC"];
  const lowerSecondary = ["CIVI-SEC", "ICT-SEC", "ARTS-SEC"];
  const scienceTrack = ["PHYS-SEC", "CHEM-SEC", "BIOL-SEC"];

  // 6e/5e: tronc commun + matières de base
  if (grade === "6e" || grade === "5e") {
    if (stream === "A") return [...common, "CIVI-SEC", "ICT-SEC"];
    if (stream === "B") return [...common, "ARTS-SEC", "ICT-SEC"];
    return [...common, "CIVI-SEC", "ARTS-SEC"];
  }

  // 4e/3e: différenciation légère par filière
  if (stream === "A") return [...common, ...scienceTrack, "CIVI-SEC"];
  if (stream === "B") return [...common, "CIVI-SEC", "ARTS-SEC", "ICT-SEC"];
  return [...common, "PHYS-SEC", "BIOL-SEC", "ICT-SEC", "ARTS-SEC"];
};

const clearCollections = async () => {
  await Promise.all([
    ReportCard.deleteMany({}),
    Grade.deleteMany({}),
    Attendance.deleteMany({}),
    Submission.deleteMany({}),
    Exam.deleteMany({}),
    Class.deleteMany({}),
    Subject.deleteMany({}),
    ActivityLog.deleteMany({}),
    User.deleteMany({}),
    AcademicYear.deleteMany({}),
  ]);
};

const buildReportCard = async (
  studentId: mongoose.Types.ObjectId,
  yearId: mongoose.Types.ObjectId,
  period: ReportPeriod
) => {
  const grades = await Grade.find({ student: studentId, year: yearId, period }).lean();
  if (!grades.length) return null;

  const percentages = grades.map((grade: any) => Number(grade.percentage) || 0);
  const totalExams = percentages.length;
  const average = Number(
    (percentages.reduce((sum, value) => sum + value, 0) / totalExams).toFixed(2)
  );
  const passedExams = percentages.filter((value) => value >= 50).length;
  const failedExams = totalExams - passedExams;
  const highestPercentage = Math.max(...percentages);
  const lowestPercentage = Math.min(...percentages);

  return ReportCard.create({
    student: studentId,
    year: yearId,
    period,
    grades: grades.map((grade: any) => grade._id),
    aggregates: {
      average,
      totalExams,
      passedExams,
      failedExams,
      highestPercentage,
      lowestPercentage,
    },
    mention: getMentionFromAverage(average),
  });
};

const run = async () => {
  await connectDB();
  console.log("Seeding extended school dataset...");

  await clearCollections();
  const rng = createDeterministicRng(20260414);

  const currentYear = await AcademicYear.create({
    name: "2025-2026",
    fromYear: mkDate("2025-09-01"),
    toYear: mkDate("2026-06-30"),
    isCurrent: true,
  });

  const previousYear = await AcademicYear.create({
    name: "2024-2025",
    fromYear: mkDate("2024-09-01"),
    toYear: mkDate("2025-06-30"),
    isCurrent: false,
  });

  const admin = await User.create({
    name: "Admin Demo",
    email: "admin@edunexus.test",
    password: seededPassword,
    role: "admin",
    isActive: true,
  });

  const adminId = asId(admin);

  const teacherProfiles = [
    { name: "Teacher Math", email: "teacher.math@edunexus.test" },
    { name: "Teacher Science", email: "teacher.science@edunexus.test" },
    { name: "Adele Kouassi", email: "teacher.adele@edunexus.test" },
    { name: "Brice N'Dri", email: "teacher.brice@edunexus.test" },
    { name: "Claire Zadi", email: "teacher.claire@edunexus.test" },
    { name: "Diane Traore", email: "teacher.diane@edunexus.test" },
    { name: "Eric Yao", email: "teacher.eric@edunexus.test" },
    { name: "Fatou Bamba", email: "teacher.fatou@edunexus.test" },
    { name: "Germain Soro", email: "teacher.germain@edunexus.test" },
    { name: "Helene Kone", email: "teacher.helene@edunexus.test" },
    { name: "Ibrahim Coulibaly", email: "teacher.ibrahim@edunexus.test" },
    { name: "Jeanne Amani", email: "teacher.jeanne@edunexus.test" },
    { name: "Kevin Dago", email: "teacher.kevin@edunexus.test" },
    { name: "Lucie Nanan", email: "teacher.lucie@edunexus.test" },
    { name: "Mariam Tano", email: "teacher.mariam@edunexus.test" },
    { name: "Nestor Bohui", email: "teacher.nestor@edunexus.test" },
    { name: "Olivia Koffi", email: "teacher.olivia@edunexus.test" },
    { name: "Pascal Ahizi", email: "teacher.pascal@edunexus.test" },
  ];

  const teachers = [] as any[];
  for (const profile of teacherProfiles) {
    teachers.push(
      await User.create({
        name: profile.name,
        email: profile.email,
        password: seededPassword,
        role: "teacher",
        isActive: true,
      })
    );
  }

  const subjectBlueprints = [
    { name: "Mathematics", code: "MATH", teacherIdx: [0, 2, 6] },
    { name: "French", code: "FREN", teacherIdx: [3, 7] },
    { name: "English", code: "ENG", teacherIdx: [4, 8] },
    { name: "Physics", code: "PHYS", teacherIdx: [1, 9] },
    { name: "Chemistry", code: "CHEM", teacherIdx: [5, 10] },
    { name: "Biology", code: "BIOL", teacherIdx: [6, 11] },
    { name: "History", code: "HIST", teacherIdx: [12, 13] },
    { name: "Geography", code: "GEOG", teacherIdx: [14, 15] },
    { name: "Civics", code: "CIVI", teacherIdx: [16] },
    { name: "ICT", code: "ICT", teacherIdx: [17] },
    { name: "Arts", code: "ARTS", teacherIdx: [13, 16] },
    { name: "Physical Education", code: "PE", teacherIdx: [12, 17] },
  ];

  const subjects = [] as any[];
  for (const blueprint of subjectBlueprints) {
    const teacherIds = blueprint.teacherIdx.map((idx) => asId(teachers[idx]));
    subjects.push(
      await Subject.create({
        name: blueprint.name,
        code: `${blueprint.code}-SEC`,
        teacher: teacherIds,
        isActive: true,
      })
    );
  }

  for (let i = 0; i < teachers.length; i += 1) {
    const teacherSubjectIds = subjects
      .filter((_, subjectIndex) => (subjectBlueprints[subjectIndex]?.teacherIdx || []).includes(i))
      .map((subject) => asId(subject));

    await User.findByIdAndUpdate(asId(teachers[i]), {
      teacherSubject: teacherSubjectIds,
    });
  }

  const gradeLabels = ["6e", "5e", "4e", "3e"];
  const streams = ["A", "B", "C"];
  const classDefinitions = gradeLabels.flatMap((grade) =>
    streams.map((stream) => ({ name: `${grade} ${stream}` }))
  );

  const subjectByCode = new Map<string, any>();
  for (const subject of subjects) {
    subjectByCode.set(subject.code, subject);
  }

  const classes = [] as any[];
  for (let i = 0; i < classDefinitions.length; i += 1) {
    const classDefinition = classDefinitions[i];
    if (!classDefinition) continue;
    const classTeacherId = asId(teachers[i % teachers.length]);
    const subjectCodes = getClassSubjectCodes(classDefinition.name);
    const subjectIds = subjectCodes
      .map((code) => subjectByCode.get(code))
      .filter(Boolean)
      .map((subject) => asId(subject));
    const classSize = 10 + ((i * 5 + 3) % 6); // 10..15

    classes.push(
      await Class.create({
        name: classDefinition.name,
        academicYear: currentYear._id,
        classTeacher: classTeacherId,
        subjects: subjectIds,
        capacity: Math.max(30, classSize + 10),
      })
    );
  }

  const classSizePlan = classes.map((_, i) => 10 + ((i * 5 + 3) % 6));
  const totalStudentsTarget = classSizePlan.reduce((sum, value) => sum + value, 0);
  const familySizes = buildFamilySizes(totalStudentsTarget);

  const classSlots = [] as string[];
  for (let i = 0; i < classes.length; i += 1) {
    const classId = asId(classes[i]);
    const plannedSize = classSizePlan[i] ?? 10;
    for (let count = 0; count < plannedSize; count += 1) {
      classSlots.push(classId);
    }
  }

  const shuffledSlots = shuffled(classSlots, rng);

  const familyNames = [
    "Kouame",
    "Konan",
    "N'Dri",
    "Koffi",
    "Kone",
    "Yao",
    "Bamba",
    "Amani",
    "Dago",
    "Traore",
    "Tano",
    "Soro",
    "Ahizi",
    "Nanan",
    "Coulibaly",
    "Kouassi",
    "Boni",
    "Sangare",
    "Ouattara",
    "Fofana",
  ];
  const childFirstNames = [
    "Aicha",
    "Amine",
    "Aya",
    "Boris",
    "Cedric",
    "Daniel",
    "Elise",
    "Fatima",
    "Grace",
    "Herve",
    "Iris",
    "Jules",
    "Kelly",
    "Lina",
    "Maya",
    "Nadia",
    "Oscar",
    "Prince",
    "Rania",
    "Samir",
    "Thea",
    "Ulrich",
    "Vanessa",
    "Warren",
    "Yasmine",
    "Zoe",
  ];

  const parentUsers = [] as any[];
  const studentUsers = [] as any[];
  const studentsByClass = new Map<string, string[]>();

  let slotCursor = 0;
  let studentCounter = 1;

  for (let familyIndex = 0; familyIndex < familySizes.length; familyIndex += 1) {
    const siblings = familySizes[familyIndex] ?? 1;
    const familyName = familyNames[familyIndex % familyNames.length];
    const parent = await User.create({
      name: `Parent ${familyName} ${familyIndex + 1}`,
      email: `parent.${String(familyIndex + 1).padStart(3, "0")}@edunexus.test`,
      password: seededPassword,
      role: "parent",
      isActive: true,
    });
    parentUsers.push(parent);

    for (let childIndex = 0; childIndex < siblings; childIndex += 1) {
      const slotIndex = slotCursor % shuffledSlots.length;
      const classId = shuffledSlots[slotIndex] || asId(classes[0]);
      slotCursor += 1;

      const firstName = childFirstNames[(studentCounter + childIndex) % childFirstNames.length];
      const student = await User.create({
        name: `${firstName} ${familyName}`,
        email: `student.${String(studentCounter).padStart(4, "0")}@edunexus.test`,
        password: seededPassword,
        role: "student",
        isActive: true,
        studentClass: classId,
        parentId: asId(parent),
      });

      studentUsers.push(student);
      studentCounter += 1;

      const classStudents = studentsByClass.get(classId) || [];
      classStudents.push(asId(student));
      studentsByClass.set(classId, classStudents);
    }
  }

  await Promise.all(
    classes.map((classDoc) =>
      Class.findByIdAndUpdate(asId(classDoc), {
        students: studentsByClass.get(asId(classDoc)) || [],
      })
    )
  );

  const classIdToName = new Map(classes.map((c) => [asId(c), c.name]));

  const examPlans = [
    { subjectCode: "MATH-SEC", title: "Mathematics Assessment", dueDate: "2025-11-15T09:00:00.000Z", maxScore: 40 },
    { subjectCode: "FREN-SEC", title: "French Composition", dueDate: "2025-12-03T09:00:00.000Z", maxScore: 30 },
    { subjectCode: "PHYS-SEC", title: "Science Test", dueDate: "2025-12-17T09:00:00.000Z", maxScore: 30 },
    { subjectCode: "ENG-SEC", title: "English Mid-Year", dueDate: "2026-02-20T09:00:00.000Z", maxScore: 30 },
    { subjectCode: "HIST-SEC", title: "History Quiz", dueDate: "2026-03-10T09:00:00.000Z", maxScore: 30 },
  ];

  const exams = [] as any[];

  for (const classDoc of classes) {
    const classId = asId(classDoc);
    for (const examPlan of examPlans) {
      const subject = subjectByCode.get(examPlan.subjectCode);
      if (!subject) continue;
      const assignedTeacherId = asId((subject.teacher || [])[0] || teachers[0]);

      exams.push(
        await Exam.create({
          title: `${classDoc.name} - ${examPlan.title}`,
          subject: asId(subject),
          class: classId,
          teacher: assignedTeacherId,
          duration: 45,
          dueDate: mkDate(examPlan.dueDate),
          isActive: true,
          questions: [
            {
              questionText: "Question 1",
              type: "MCQ",
              options: ["A", "B", "C", "D"],
              correctAnswer: "B",
              points: Math.round(examPlan.maxScore / 2),
            },
            {
              questionText: "Question 2",
              type: "MCQ",
              options: ["A", "B", "C", "D"],
              correctAnswer: "C",
              points: examPlan.maxScore - Math.round(examPlan.maxScore / 2),
            },
          ],
        })
      );
    }
  }

  const submissionsPayload: any[] = [];
  const gradesPayload: any[] = [];

  for (let examIndex = 0; examIndex < exams.length; examIndex += 1) {
    const exam = exams[examIndex];
    const classStudents = studentsByClass.get(asId(exam.class)) || [];
    const maxScore = Number(
      (exam.questions || []).reduce((sum: number, q: any) => sum + Number(q.points || 0), 0)
    );
    const period = pickPeriodByMonth(new Date(exam.dueDate).getUTCMonth() + 1);

    for (let studentIndex = 0; studentIndex < classStudents.length; studentIndex += 1) {
      const studentId = classStudents[studentIndex];
      if (!studentId) continue;
      const base = 12 + ((examIndex * 7 + studentIndex * 11) % Math.max(8, maxScore - 8));
      const score = Math.min(maxScore, Math.max(6, base));
      const percentage = Number(((score / maxScore) * 100).toFixed(2));

      submissionsPayload.push({
        exam: exam._id,
        student: studentId,
        answers: [],
        score,
      });

      gradesPayload.push({
        exam: exam._id,
        student: studentId,
        score,
        maxScore,
        percentage,
        subject: exam.subject,
        year: currentYear._id,
        period,
      });
    }
  }

  if (submissionsPayload.length) {
    await Submission.insertMany(submissionsPayload, { ordered: false });
  }
  if (gradesPayload.length) {
    await Grade.insertMany(gradesPayload, { ordered: false });
  }

  for (const student of studentUsers) {
    const studentId = student._id as mongoose.Types.ObjectId;
    await buildReportCard(studentId, currentYear._id, "term1");
    await buildReportCard(studentId, currentYear._id, "term2");
  }

  const attendancePayload: any[] = [];
  const attendanceDates = [mkDate("2026-04-09T00:00:00.000Z"), mkDate("2026-04-10T00:00:00.000Z")];

  for (const classDoc of classes) {
    const classId = asId(classDoc);
    const classStudents = studentsByClass.get(classId) || [];

    for (let dateIndex = 0; dateIndex < attendanceDates.length; dateIndex += 1) {
      const date = attendanceDates[dateIndex];
      for (let i = 0; i < classStudents.length; i += 1) {
        const studentId = classStudents[i];
        if (!studentId) continue;
        const statusKey = (i + dateIndex) % 10;
        const status = statusKey < 7 ? "present" : statusKey < 9 ? "late" : "absent";
        attendancePayload.push({
          student: studentId,
          class: classId,
          date,
          status,
          markedBy: classDoc.classTeacher,
        });
      }
    }
  }

  if (attendancePayload.length) {
    await Attendance.insertMany(attendancePayload, { ordered: false });
  }

  const activityPayload = [
    {
      user: adminId,
      action: "Seeded academic year",
      details: `Created years ${currentYear.name} and ${previousYear.name}`,
    },
    {
      user: adminId,
      action: "Created secondary school structure",
      details: `${classes.length} classes / ${studentUsers.length} students / ${parentUsers.length} parents`,
    },
    ...teachers.slice(0, 8).map((teacher, idx) => ({
      user: asId(teacher),
      action: "Created exam",
      details: exams[idx]?.title || `Exam slot ${idx + 1}`,
    })),
    ...studentUsers.slice(0, 12).map((student, idx) => ({
      user: asId(student),
      action: "Submitted exam",
      details: exams[idx % exams.length]?.title || "General evaluation",
    })),
  ];

  await ActivityLog.insertMany(activityPayload, { ordered: false });

  console.log("Seed complete. Test credentials:");
  console.log("- Admin: admin@edunexus.test / password123");
  console.log("- Teacher (Math): teacher.math@edunexus.test / password123");
  console.log("- Teacher (Science): teacher.science@edunexus.test / password123");
  console.log("- Parent sample: parent.001@edunexus.test / password123");
  console.log("- Student sample: student.0001@edunexus.test / password123");
  console.log(
    `- Summary: ${classes.length} classes, ${teachers.length} teachers, ${studentUsers.length} students, ${parentUsers.length} parents`
  );
  console.log(
    `- Example class sizes: ${classes
      .slice(0, 6)
      .map((classDoc) => `${classIdToName.get(asId(classDoc))}:${(studentsByClass.get(asId(classDoc)) || []).length}`)
      .join(" | ")}`
  );

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.connection.close();
  process.exit(1);
});
