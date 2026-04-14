import mongoose, { Schema, Document } from "mongoose";

export type ExamGenerationStatus = "queued" | "running" | "completed" | "failed";

export interface IExamGeneration extends Document {
  exam: mongoose.Types.ObjectId;
  status: ExamGenerationStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const examGenerationSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      required: true,
    },
    message: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IExamGeneration>("ExamGeneration", examGenerationSchema);
