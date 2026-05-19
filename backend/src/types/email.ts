/**
 * Email types extracted from legacy models
 * Now used only for type checking with Prisma
 */

export type EmailEventType =
  | "exam_result"
  | "report_card_available"
  | "report_card_sent"
  | "payment_reminder"
  | "grade_reminder_48h"
  | "grade_reminder_72h"
  | "school_invite"
  | "master_login_otp"
  | "master_password_change_otp"
  | "contact_request"
  | "school_approved";

export type EmailStatus = "sent" | "failed";
