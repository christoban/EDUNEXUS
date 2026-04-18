export type UserRole = "admin" | "teacher" | "student" | "parent";
export type SchoolSection = "francophone" | "anglophone" | "bilingual";
export type SchoolOnboardingStatus = "draft" | "pending" | "approved" | "provisioning" | "active" | "rejected";

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
  schoolId?: string | null;
  studentClass?: Class;
  teacherSubjects?: subject[];
  parentLanguagePreference?: "fr" | "en";
  schoolSection?: SchoolSection;
  uiLanguagePreference?: "fr" | "en";
}

export interface SchoolTemplate {
  key: string;
  label: string;
  description: string;
  systemType: "francophone" | "anglophone" | "bilingual";
  structure: "simple" | "complex";
  schoolMotto: string;
  gradingSystem: "over_20" | "percent" | "grades_ae" | "competency_ana";
  passingGrade: number;
  termsType: "sequences_6" | "terms_3" | "monthly_9" | "trimesters_3";
  bulletinFormat: "standard" | "detailed" | "compact";
  includeRankings: boolean;
}

export interface SchoolInviteSummary {
  token: string;
  requestedAdminName: string;
  requestedAdminEmail: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  acceptedAt?: string | null;
}

export interface SchoolOnboardingInviteSummary {
  token: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  acceptedAt?: string | null;
  requestedAdminName: string;
  requestedAdminEmail: string;
  createdAt?: string;
}

export interface SchoolOnboardingRequestSummary {
  _id: string;
  schoolName: string;
  dbName: string;
  systemType: "francophone" | "anglophone" | "bilingual";
  structure: "simple" | "complex";
  isActive: boolean;
  onboardingStatus: SchoolOnboardingStatus;
  templateKey?: string | null;
  requestedAdminName?: string | null;
  requestedAdminEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
  latestInvite?: SchoolOnboardingInviteSummary | null;
}

export interface SchoolOnboardingRequestsResponse {
  requests: SchoolOnboardingRequestSummary[];
  pagination: pagination;
  filters: {
    status: SchoolOnboardingStatus | null;
    search: string | null;
  };
}

export interface MasterSchoolSummary {
  _id: string;
  schoolName: string;
  schoolMotto: string;
  systemType: "francophone" | "anglophone" | "bilingual";
  structure: "simple" | "complex";
  dbName: string;
  foundedYear?: number | null;
  location?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
  isPilot: boolean;
  onboardingStatus: SchoolOnboardingStatus;
  templateKey?: string | null;
  requestedAdminName?: string | null;
  requestedAdminEmail?: string | null;
  parentComplex?: { complexName?: string | null } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MasterSchoolDetail extends MasterSchoolSummary {
  dbConnectionString: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  foundedYear?: number | null;
  location?: string | null;
}

export interface academicYear {
  _id: string;
  name: string; // "2024-2025"
  fromYear: Date; // "2024-09-01"
  toYear: Date; // "2025-06-30"
  isCurrent: boolean; // true/false
}

export interface SchoolSettings {
  schoolName: string;
  schoolMotto: string;
  schoolLogoUrl?: string;
  academicCalendarType: "trimester" | "semester";
  preferredLanguage: "fr" | "en";
  schoolLanguageMode: "anglophone" | "francophone" | "bilingual";
  mode: "simple_fr" | "simple_en" | "bilingual" | "complex";
  cycles: Array<"maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique">;
  hasMultipleCycles: boolean;
  officialLanguages: Array<"fr" | "en">;
  attendanceLateAsAbsence: boolean;
  attendanceExcusedCountsAsAbsence: boolean;
  councilDecisionMode: "manual" | "automatic";
  councilPassAverageThreshold: number;
  councilMaxAbsences: number;
  bulletinBlockOnUnpaidFees: boolean;
  bulletinAllowedOutstandingBalance: number;
}

export interface SubSystem {
  _id: string;
  code:
    | "FR_GENERAL_SEC"
    | "FR_PRIMAIRE"
    | "FR_TECHNIQUE_SEC"
    | "EN_GENERAL_SEC"
    | "EN_PRIMAIRE"
    | "EN_TECHNIQUE_SEC"
    | "MATERNELLE";
  name: string;
  gradingScale: "OVER_20" | "PERCENT" | "GRADES_AE" | "COMPETENCY_ANA";
  periodType: "SEQUENCES_6" | "TERMS_3" | "MONTHLY_9";
  hasCoefficientBySubject: boolean;
  passThreshold: number;
  bulletinTemplate?: string | null;
  isActive: boolean;
}

export interface Section {
  _id: string;
  schoolSettings?: string | null;
  subSystem: SubSystem | string;
  name: string;
  language: "fr" | "en";
  cycle: "maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique";
  isActive: boolean;
}

export interface AcademicPeriod {
  _id: string;
  academicYear: academicYear | string;
  section: Section | string;
  type: "SEQUENCE" | "TERM" | "MONTH";
  number: number;
  trimester?: number | null;
  startDate: string;
  endDate: string;
  isBulletinPeriod: boolean;
  isCouncilPeriod: boolean;
}

export interface Class {
  _id: string;
  name: string; // e.g., "Grade 10"
  academicYear: academicYear; // Link to "2024-2025"
  section?: Section | string | null;
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
  scoreOn20?: number;
  coefficient?: number;
  gradeLabel?: string | null;
  gradingScale?: "OVER_20" | "PERCENT" | "GRADES_AE" | "COMPETENCY_ANA";
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
    averageScoreOn20?: number;
    totalExams: number;
    passedExams: number;
    failedExams: number;
    highestPercentage: number;
    lowestPercentage: number;
  };
  mention: string;
}

export type EmailEventType = "exam_result" | "report_card_available" | "payment_reminder" | "school_invite" | "master_login_otp" | "master_password_change_otp";
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

export interface MasterSchoolActivityLog {
  _id: string;
  user: {
    _id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | string;
  action: string;
  details?: string | null;
  createdAt: string;
}

export interface MasterSchoolActivityLogsResponse {
  logs: MasterSchoolActivityLog[];
  pagination: pagination;
}

export interface MasterSchoolInviteEmailStatus {
  recipientEmail: string;
  status: "sent" | "failed";
  sentAt: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}
