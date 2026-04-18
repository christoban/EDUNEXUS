import mongoose, { Document, Schema } from "mongoose";

export type EmailEventType =
  | "exam_result"
  | "report_card_available"
  | "payment_reminder"
  | "school_invite"
  | "master_login_otp"
  | "master_password_change_otp";
export type EmailStatus = "sent" | "failed";

export interface IEmailLog extends Document {
  recipientEmail: string;
  recipientUser?: mongoose.Types.ObjectId | null;
  subject: string;
  template: string;
  eventType: EmailEventType;
  status: EmailStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  relatedEntityType?: string | null;
  relatedEntityId?: mongoose.Types.ObjectId | null;
  sentAt: Date;
}

const emailLogSchema = new Schema<IEmailLog>(
  {
    recipientEmail: { type: String, required: true, index: true },
    recipientUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    subject: { type: String, required: true },
    template: { type: String, required: true },
    eventType: {
      type: String,
      enum: ["exam_result", "report_card_available", "payment_reminder", "school_invite", "master_login_otp", "master_password_change_otp"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["sent", "failed"],
      required: true,
      index: true,
    },
    providerMessageId: { type: String, default: null },
    errorMessage: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    relatedEntityType: { type: String, default: null, index: true },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<IEmailLog>("EmailLog", emailLogSchema);
