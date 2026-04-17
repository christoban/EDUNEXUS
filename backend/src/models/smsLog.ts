import mongoose, { Document, Schema } from "mongoose";

export type SmsEventType = "payment_reminder";
export type SmsStatus = "sent" | "delivered" | "failed";

export interface ISmsLog extends Document {
  recipientPhone: string;
  recipientUser?: mongoose.Types.ObjectId | null;
  message: string;
  eventType: SmsEventType;
  status: SmsStatus;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  relatedEntityType?: string | null;
  relatedEntityId?: mongoose.Types.ObjectId | null;
  statusCheckedAt?: Date | null;
  lastProviderPayload?: Record<string, unknown> | null;
  sentAt: Date;
}

const smsLogSchema = new Schema<ISmsLog>(
  {
    recipientPhone: { type: String, required: true, index: true },
    recipientUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    message: { type: String, required: true },
    eventType: {
      type: String,
      enum: ["payment_reminder"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "failed"],
      required: true,
      index: true,
    },
    providerMessageId: { type: String, default: null, index: true },
    providerStatus: { type: String, default: null },
    errorMessage: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    relatedEntityType: { type: String, default: null, index: true },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    statusCheckedAt: { type: Date, default: null },
    lastProviderPayload: { type: Schema.Types.Mixed, default: null },
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISmsLog>("SmsLog", smsLogSchema);
