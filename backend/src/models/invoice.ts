import mongoose, { Schema, type Document } from "mongoose";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export interface IInvoiceLine {
  feePlan?: mongoose.Types.ObjectId;
  label: string;
  category: string;
  amount: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  student: mongoose.Types.ObjectId;
  class: mongoose.Types.ObjectId;
  academicYear: mongoose.Types.ObjectId;
  currency: "XAF";
  lines: IInvoiceLine[];
  totalAmount: number;
  amountPaid: number;
  balance: number;
  dueDate: Date;
  issuedAt?: Date;
  status: InvoiceStatus;
  notes?: string;
}

const invoiceLineSchema = new Schema<IInvoiceLine>(
  {
    feePlan: { type: Schema.Types.ObjectId, ref: "FeePlan" },
    label: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
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
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    currency: { type: String, enum: ["XAF"], default: "XAF", required: true },
    lines: { type: [invoiceLineSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true, index: true },
    issuedAt: { type: Date },
    status: {
      type: String,
      enum: ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"],
      default: "issued",
      index: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

invoiceSchema.index({ student: 1, academicYear: 1, dueDate: 1 });

export default mongoose.model<IInvoice>("Invoice", invoiceSchema);
