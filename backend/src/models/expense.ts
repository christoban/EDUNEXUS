import mongoose, { Schema, type Document } from "mongoose";

export type ExpenseCategory =
  | "salary"
  | "utilities"
  | "maintenance"
  | "supplies"
  | "transport"
  | "other";

export interface IExpense extends Document {
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: "XAF";
  expenseDate: Date;
  paymentMethod: "cash" | "bank_transfer" | "mobile_money_mtn" | "mobile_money_orange";
  transactionReference?: string;
  recordedBy: mongoose.Types.ObjectId;
}

const expenseSchema = new Schema<IExpense>(
  {
    category: {
      type: String,
      required: true,
      enum: ["salary", "utilities", "maintenance", "supplies", "transport", "other"],
    },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ["XAF"], default: "XAF", required: true },
    expenseDate: { type: Date, required: true, default: Date.now, index: true },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["cash", "bank_transfer", "mobile_money_mtn", "mobile_money_orange"],
    },
    transactionReference: { type: String, trim: true },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IExpense>("Expense", expenseSchema);
