export type UserRole = "admin" | "teacher" | "student" | "parent";
export type SchoolSection = "francophone" | "anglophone" | "bilingual";

export interface pagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface user {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  studentClass?: Class;
  teacherSubjects?: subject[];
  parentLanguagePreference?: "fr" | "en";
  schoolSection?: SchoolSection;
  uiLanguagePreference?: "fr" | "en";
}

export interface academicYear {
  _id: string;
  name: string; // "2024-2025"
  fromYear: Date; // "2024-09-01"
  toYear: Date; // "2025-06-30"
  isCurrent: boolean; // true/false
}

export interface Class {
  _id: string;
  name: string; // e.g., "Grade 10"
  academicYear: academicYear; // Link to "2024-2025"
  classTeacher: user; // The main teacher in charge
  subjects: subject[]; // List of subjects taught in this class
  students: user[]; // List of students enrolled
  studentCount?: number; // Calculated from users assigned to this class
  capacity: number; // Max students allowed (optional)
}

export interface subject {
  _id: string;
  name: string; // "Mathematics"
  code: string; // "MATH101"
  teacher?: user[]; // Default teacher for this subject
  coefficient?: number; // Used for report cards / bulletins
  teacherCount?: number; // Calculated from users assigned to this subject
  isActive: boolean; // Indicates if the subject is currently active
}

export interface question {
  _id: string;
  questionText: string;
  type: string;
  options: string[]; // Array of strings e.g. ["A", "B", "C", "D"]
  correctAnswer: string; // Hidden from students in default queries
  points: number;
}

export interface exam {
  _id: string;
  title: string;
  subject: subject;
  class: Class;
  teacher: user;
  duration: number; // in minutes
  questions: question[];
  dueDate: Date;
  isActive: boolean;
  hasSubmitted?: boolean;
}

export interface Submission {
  _id: string;
  score: number;
  exam: exam; // The populated exam with answers
  answers: { questionId: string; answer: string }[];
}

export interface period {
  _id: string;
  kind?: "class" | "break";
  subject?: { _id: string; name: string; code: string } | null;
  teacher?: { _id: string; name: string } | null;
  startTime: string; // e.g., "08:00"
  endTime: string; // e.g., "08:45"
}

export interface schedule {
  day: string; // "Monday", "Tuesday", etc.
  periods: period[];
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  _id: string;
  student: user;
  class: { _id: string; name: string };
  date: string;
  status: AttendanceStatus;
  markedBy: { _id: string; name: string; role: UserRole };
}

export type ReportPeriod = "term1" | "term2" | "term3" | "annual";

export interface Grade {
  _id: string;
  exam: string;
  student: string;
  score: number;
  maxScore: number;
  percentage: number;
  subject: string;
  year: string;
  period: ReportPeriod;
}

export interface ReportCard {
  _id: string;
  student: user;
  year: academicYear;
  period: ReportPeriod;
  grades: Grade[];
  aggregates: {
    average: number;
    totalExams: number;
    passedExams: number;
    failedExams: number;
    highestPercentage: number;
    lowestPercentage: number;
  };
  mention: string;
}

export type EmailEventType = "exam_result" | "report_card_available";
export type EmailStatus = "sent" | "failed";

export interface EmailLog {
  _id: string;
  recipientEmail: string;
  recipientUser?: user;
  subject: string;
  template: string;
  eventType: EmailEventType;
  status: EmailStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt: string;
  metadata?: Record<string, unknown>;
}
