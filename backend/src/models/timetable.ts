import mongoose, { Schema, Document } from "mongoose";

export interface IPeriod {
  subject?: mongoose.Types.ObjectId | null;
  teacher?: mongoose.Types.ObjectId | null;
  kind?: "class" | "break";
  startTime: string; // e.g., "08:00"
  endTime: string; // e.g., "08:45"
}

export interface IDaySchedule {
  day: string; // "Monday", "Tuesday", etc.
  periods: IPeriod[];
}

export interface ITimetable extends Document {
  class: mongoose.Types.ObjectId;
  academicYear: mongoose.Types.ObjectId;
  schedule: IDaySchedule[];
  createdAt: Date;
}

const timetableSchema = new Schema(
  {
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    schedule: [
      {
        day: { type: String, required: true },
        periods: [
          {
            kind: { type: String, enum: ["class", "break"], default: "class" },
            subject: { type: Schema.Types.ObjectId, ref: "Subject" },
            teacher: { type: Schema.Types.ObjectId, ref: "User" },
            startTime: String,
            endTime: String,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

// Prevent multiple timetables for the same class/year
timetableSchema.index({ class: 1, academicYear: 1 }, { unique: true });

export default mongoose.model<ITimetable>("Timetable", timetableSchema);