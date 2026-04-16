import mongoose, { Schema, type Document } from "mongoose";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "mobile_money_mtn"
  | "mobile_money_orange";

export interface IPayment extends Document {
  invoice: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  amount: number;
  currency: "XAF";
  paymentDate: Date;
  method: PaymentMethod;
  transactionReference?: string;
  receiptNumber: string;
  receivedBy: mongoose.Types.ObjectId;
  notes?: string;
}

const paymentSchema = new Schema<IPayment>(
  {
    invoice: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ["XAF"], default: "XAF", required: true },
    paymentDate: { type: Date, required: true, default: Date.now },
    method: {
      type: String,
      required: true,
      enum: ["cash", "bank_transfer", "mobile_money_mtn", "mobile_money_orange"],
    },
    transactionReference: { type: String, trim: true },
    receiptNumber: { type: String, required: true, unique: true, index: true },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

paymentSchema.index({ student: 1, paymentDate: -1 });

export default mongoose.model<IPayment>("Payment", paymentSchema);
