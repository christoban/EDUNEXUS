import express from "express";
import { protect, authorize } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import {
  createExpenseBodySchema,
  createFeePlanBodySchema,
  createInvoiceBodySchema,
  createInvoicesFromFeePlanBodySchema,
  createPaymentBodySchema,
  expenseQuerySchema,
  financeReportQuerySchema,
  idParamSchema,
  invoiceQuerySchema,
  paymentQuerySchema,
  smsMsgIdParamSchema,
  sendFinanceReminderBodySchema,
  updateFeePlanBodySchema,
} from "../validation/schemas.ts";
import {
  createExpense,
  createFeePlan,
  createInvoice,
  createInvoicesFromFeePlan,
  downloadPaymentReceiptPdf,
  getClassSchedule,
  getExpenses,
  getFeePlans,
  getInvoiceById,
  getInvoices,
  getOverdueStudents,
  getPayments,
  getRevenueByPeriod,
  getSmsStatus,
  recordPayment,
  sendPaymentReminder,
  updateFeePlan,
  deleteFeePlan,
} from "../controllers/finance.ts";

const financeRouter = express.Router();

financeRouter.use(protect, authorize(["admin"]));

financeRouter.post(
  "/fee-plans",
  sensitiveWriteLimiter,
  validate({ body: createFeePlanBodySchema }),
  createFeePlan
);
financeRouter.get("/fee-plans", getFeePlans);
financeRouter.patch(
  "/fee-plans/:id",
  sensitiveWriteLimiter,
  validate({ params: idParamSchema, body: updateFeePlanBodySchema }),
  updateFeePlan
);
financeRouter.delete(
  "/fee-plans/:id",
  sensitiveWriteLimiter,
  validate({ params: idParamSchema }),
  deleteFeePlan
);

financeRouter.post(
  "/invoices",
  sensitiveWriteLimiter,
  validate({ body: createInvoiceBodySchema }),
  createInvoice
);
financeRouter.post(
  "/invoices/from-fee-plan",
  sensitiveWriteLimiter,
  validate({ body: createInvoicesFromFeePlanBodySchema }),
  createInvoicesFromFeePlan
);
financeRouter.get("/invoices", validate({ query: invoiceQuerySchema }), getInvoices);
financeRouter.get("/invoices/:id", validate({ params: idParamSchema }), getInvoiceById);

financeRouter.post(
  "/payments",
  sensitiveWriteLimiter,
  validate({ body: createPaymentBodySchema }),
  recordPayment
);
financeRouter.get("/payments", validate({ query: paymentQuerySchema }), getPayments);
financeRouter.get(
  "/payments/:id/receipt.pdf",
  validate({ params: idParamSchema }),
  downloadPaymentReceiptPdf
);

financeRouter.post(
  "/expenses",
  sensitiveWriteLimiter,
  validate({ body: createExpenseBodySchema }),
  createExpense
);
financeRouter.get("/expenses", validate({ query: expenseQuerySchema }), getExpenses);

financeRouter.get(
  "/reports/overdue-students",
  validate({ query: financeReportQuerySchema }),
  getOverdueStudents
);
financeRouter.get(
  "/reports/class-schedule",
  validate({ query: financeReportQuerySchema }),
  getClassSchedule
);
financeRouter.get(
  "/reports/revenue",
  validate({ query: financeReportQuerySchema }),
  getRevenueByPeriod
);
financeRouter.post(
  "/reminders/send",
  sensitiveWriteLimiter,
  validate({ body: sendFinanceReminderBodySchema }),
  sendPaymentReminder
);
financeRouter.get(
  "/sms/status/:msgId",
  validate({ params: smsMsgIdParamSchema }),
  getSmsStatus
);

export default financeRouter;
