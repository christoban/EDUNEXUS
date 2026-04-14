import mongoose, { Schema, type Document } from "mongoose";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface IAttendance extends Document {
  student: mongoose.Types.ObjectId;
  class: mongoose.Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  markedBy: mongoose.Types.ObjectId;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      required: true,
      default: "present",
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One attendance record per student/class/day.
attendanceSchema.index({ student: 1, class: 1, date: 1 }, { unique: true });

export default mongoose.model<IAttendance>("Attendance", attendanceSchema);
