import { type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import FeePlan from "../models/feePlan.ts";
import Invoice from "../models/invoice.ts";
import Payment from "../models/payment.ts";
import Expense from "../models/expense.ts";
import User from "../models/user.ts";
import SmsLog from "../models/smsLog.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { getSmsDeliveryStatus, sendSms } from "../services/smsService.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { resolveUserLanguage } from "../utils/languageHelper.ts";
import { buildPaymentReminderTemplate } from "../utils/emailTemplates.ts";
import { emitSmsDelivered } from "../socket/io.ts";

const asDate = (value?: string) => (value ? new Date(value) : undefined);

const generateInvoiceNumber = () =>
  `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
    100000 + Math.random() * 900000
  )}`;

const generateReceiptNumber = () =>
  `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
    100000 + Math.random() * 900000
  )}`;

const recalculateInvoiceStatus = (totalAmount: number, amountPaid: number, dueDate: Date) => {
  const balance = Math.max(totalAmount - amountPaid, 0);
  if (balance === 0) return { status: "paid", balance };
  if (amountPaid > 0) return { status: "partially_paid", balance };
  if (dueDate.getTime() < Date.now()) return { status: "overdue", balance };
  return { status: "issued", balance };
};

const getPagination = (req: Request, defaultLimit = 20) => {
  const query = ((req as any).validatedQuery || req.query) as any;
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || defaultLimit;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const createFeePlan = async (req: Request, res: Response) => {
  try {
    const feePlan = await FeePlan.create({ ...req.body, currency: "XAF" });

    await logActivity({
      userId: (req as any).user._id,
      action: `Created fee plan: ${feePlan.name}`,
    });

    return res.status(201).json(feePlan);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getFeePlans = async (req: Request, res: Response) => {
  try {
    const query = ((req as any).validatedQuery || req.query) as any;
    const { page, limit, skip } = getPagination(req, 20);

    const filter: any = {};
    if (query.academicYearId) filter.academicYear = query.academicYearId;
    if (query.classId) filter.classes = { $in: [query.classId] };
    if (query.category) filter.category = query.category;

    const [total, feePlans] = await Promise.all([
      FeePlan.countDocuments(filter),
      FeePlan.find(filter)
        .populate("academicYear", "name")
        .populate("classes", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      feePlans,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const updateFeePlan = async (req: Request, res: Response) => {
  try {
    const feePlan = await FeePlan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!feePlan) {
      return res.status(404).json({ message: "Fee plan not found" });
    }

    await logActivity({
      userId: (req as any).user._id,
      action: `Updated fee plan: ${feePlan.name}`,
    });

    return res.json(feePlan);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const deleteFeePlan = async (req: Request, res: Response) => {
  try {
    const feePlan = await FeePlan.findByIdAndDelete(req.params.id);
    if (!feePlan) {
      return res.status(404).json({ message: "Fee plan not found" });
    }

    await logActivity({
      userId: (req as any).user._id,
      action: `Deleted fee plan: ${feePlan.name}`,
    });

    return res.json({ message: "Fee plan deleted" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { studentId, classId, academicYearId, dueDate, lines, notes } = req.body;

    const totalAmount = lines.reduce((sum: number, line: any) => sum + Number(line.amount), 0);
    const invoice = await Invoice.create({
      invoiceNumber: generateInvoiceNumber(),
      student: studentId,
      class: classId,
      academicYear: academicYearId,
      lines,
      totalAmount,
      amountPaid: 0,
      balance: totalAmount,
      dueDate: new Date(dueDate),
      status: "issued",
      currency: "XAF",
      issuedAt: new Date(),
      notes,
    });

    await logActivity({
      userId: (req as any).user._id,
      action: `Created invoice ${invoice.invoiceNumber}`,
    });

    return res.status(201).json(invoice);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const createInvoicesFromFeePlan = async (req: Request, res: Response) => {
  try {
    const { feePlanId, dueDate, classId, studentId, notes } = req.body;

    const feePlan = await FeePlan.findById(feePlanId);
    if (!feePlan) {
      return res.status(404).json({ message: "Fee plan not found" });
    }

    const classFilter = classId ? [classId] : feePlan.classes.map((c) => String(c));
    const studentFilter: any = {
      role: "student",
      studentClass: { $in: classFilter },
      isActive: true,
    };

    if (studentId) studentFilter._id = studentId;

    const students = await User.find(studentFilter).select("_id studentClass").lean();

    if (!students.length) {
      return res.status(400).json({ message: "No students matched for invoice generation" });
    }

    const dueDateObj = new Date(dueDate);

    const docs = students.map((student: any) => ({
      invoiceNumber: generateInvoiceNumber(),
      student: student._id,
      class: student.studentClass,
      academicYear: feePlan.academicYear,
      lines: [
        {
          feePlan: feePlan._id,
          label: feePlan.name,
          category: feePlan.category,
          amount: feePlan.amount,
        },
      ],
      totalAmount: feePlan.amount,
      amountPaid: 0,
      balance: feePlan.amount,
      dueDate: dueDateObj,
      status: "issued",
      currency: "XAF",
      issuedAt: new Date(),
      notes,
    }));

    const invoices = await Invoice.insertMany(docs);

    await logActivity({
      userId: (req as any).user._id,
      action: `Generated ${invoices.length} invoices from fee plan ${feePlan.name}`,
    });

    return res.status(201).json({
      message: "Invoices generated",
      count: invoices.length,
      invoices,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const query = ((req as any).validatedQuery || req.query) as any;
    const { page, limit, skip } = getPagination(req, 20);

    const filter: any = {};
    if (query.studentId) filter.student = query.studentId;
    if (query.classId) filter.class = query.classId;
    if (query.academicYearId) filter.academicYear = query.academicYearId;
    if (query.status) filter.status = query.status;
    if (query.dueBefore) filter.dueDate = { $lte: new Date(query.dueBefore) };

    const [total, invoices] = await Promise.all([
      Invoice.countDocuments(filter),
      Invoice.find(filter)
        .populate("student", "name email")
        .populate("class", "name")
        .populate("academicYear", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      invoices,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("student", "name email")
      .populate("class", "name")
      .populate("academicYear", "name");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const payments = await Payment.find({ invoice: invoice._id }).sort({ paymentDate: -1 });

    return res.json({ invoice, payments });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const recordPayment = async (req: Request, res: Response) => {
  try {
    const { invoiceId, amount, paymentDate, method, transactionReference, notes } = req.body;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({ message: "Cannot pay a cancelled invoice" });
    }

    if (Number(amount) > invoice.balance) {
      return res.status(400).json({
        message: `Payment amount exceeds remaining balance (${invoice.balance} XAF)`,
      });
    }

    const payment = await Payment.create({
      invoice: invoice._id,
      student: invoice.student,
      amount,
      currency: "XAF",
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      method,
      transactionReference,
      receiptNumber: generateReceiptNumber(),
      receivedBy: (req as any).user._id,
      notes,
    });

    invoice.amountPaid = Number(invoice.amountPaid) + Number(amount);
    const recalculated = recalculateInvoiceStatus(
      Number(invoice.totalAmount),
      Number(invoice.amountPaid),
      new Date(invoice.dueDate)
    );
    invoice.balance = recalculated.balance;
    invoice.status = recalculated.status as any;
    await invoice.save();

    await logActivity({
      userId: (req as any).user._id,
      action: `Recorded payment ${payment.receiptNumber} for invoice ${invoice.invoiceNumber}`,
    });

    return res.status(201).json({ payment, invoice });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const query = ((req as any).validatedQuery || req.query) as any;
    const { page, limit, skip } = getPagination(req, 20);

    const filter: any = {};
    if (query.invoiceId) filter.invoice = query.invoiceId;
    if (query.studentId) filter.student = query.studentId;
    if (query.method) filter.method = query.method;
    if (query.from || query.to) {
      filter.paymentDate = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .populate("student", "name email")
        .populate("invoice", "invoiceNumber totalAmount balance status")
        .populate("receivedBy", "name")
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      payments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const expense = await Expense.create({
      ...req.body,
      currency: "XAF",
      expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : new Date(),
      recordedBy: (req as any).user._id,
    });

    await logActivity({
      userId: (req as any).user._id,
      action: `Recorded expense: ${expense.category} (${expense.amount} XAF)`,
    });

    return res.status(201).json(expense);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const query = ((req as any).validatedQuery || req.query) as any;
    const { page, limit, skip } = getPagination(req, 20);

    const filter: any = {};
    if (query.category) filter.category = query.category;
    if (query.from || query.to) {
      filter.expenseDate = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const [total, expenses] = await Promise.all([
      Expense.countDocuments(filter),
      Expense.find(filter)
        .populate("recordedBy", "name")
        .sort({ expenseDate: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      expenses,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getOverdueStudents = async (req: Request, res: Response) => {
  try {
    const schoolSettings = await getEffectiveSchoolSettings();
    const bulletinPolicy = {
      blockOnUnpaidFees: Boolean(schoolSettings.bulletinBlockOnUnpaidFees),
      allowedOutstandingBalance: Number(schoolSettings.bulletinAllowedOutstandingBalance || 0),
    };

    const query = ((req as any).validatedQuery || req.query) as any;
    const match: any = {
      status: { $in: ["issued", "partially_paid", "overdue"] },
      dueDate: { $lt: new Date() },
      balance: { $gt: 0 },
    };

    if (query.classId) match.class = query.classId;

    const overdue = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$student",
          totalOutstanding: { $sum: "$balance" },
          invoiceCount: { $sum: 1 },
          latestDueDate: { $max: "$dueDate" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $project: {
          _id: 0,
          studentId: "$student._id",
          studentName: "$student.name",
          studentEmail: "$student.email",
          totalOutstanding: 1,
          invoiceCount: 1,
          latestDueDate: 1,
        },
      },
      { $sort: { totalOutstanding: -1 } },
    ]);

    if (!overdue.length) {
      return res.json({ overdueStudents: [], total: 0 });
    }

    const studentIds = overdue
      .map((item: any) => item.studentId)
      .filter(Boolean);

    const latestSmsLogs = await SmsLog.aggregate([
      {
        $match: {
          eventType: "payment_reminder",
          relatedEntityType: "Student",
          relatedEntityId: { $in: studentIds },
        },
      },
      { $sort: { sentAt: -1, createdAt: -1 } },
      {
        $group: {
          _id: "$relatedEntityId",
          smsLog: { $first: "$$ROOT" },
        },
      },
    ]);

    const smsByStudentId = new Map(
      latestSmsLogs.map((entry: any) => [
        String(entry._id),
        {
          smsLogId: String(entry.smsLog?._id || ""),
          providerMessageId: entry.smsLog?.providerMessageId || null,
          status: entry.smsLog?.status || "sent",
          providerStatus: entry.smsLog?.providerStatus || null,
          sentAt: entry.smsLog?.sentAt || null,
        },
      ])
    );

    const enrichedOverdue = overdue.map((item: any) => {
      const outstanding = Number(item.totalOutstanding || 0);
      const bulletinBlocked =
        bulletinPolicy.blockOnUnpaidFees &&
        outstanding > bulletinPolicy.allowedOutstandingBalance;

      return {
        ...item,
        bulletinBlocked,
        bulletinEligibility: bulletinBlocked ? "blocked" : "eligible",
        bulletinAllowedOutstandingBalance: bulletinPolicy.allowedOutstandingBalance,
        lastSms: smsByStudentId.get(String(item.studentId)) || null,
      };
    });

    return res.json({
      overdueStudents: enrichedOverdue,
      total: enrichedOverdue.length,
      bulletinPolicy,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getClassSchedule = async (req: Request, res: Response) => {
  try {
    const query = ((req as any).validatedQuery || req.query) as any;
    if (!query.classId) {
      return res.status(400).json({ message: "classId is required" });
    }

    const invoices = await Invoice.find({ class: query.classId })
      .populate("student", "name email")
      .sort({ dueDate: 1 });

    return res.json({
      schedule: invoices.map((invoice) => ({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        student: invoice.student,
        dueDate: invoice.dueDate,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        balance: invoice.balance,
        status: invoice.status,
      })),
      total: invoices.length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getRevenueByPeriod = async (req: Request, res: Response) => {
  try {
    const query = ((req as any).validatedQuery || req.query) as any;
    const from = asDate(query.from) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = asDate(query.to) || new Date();

    const revenue = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          paymentCount: { $sum: 1 },
          cashTotal: {
            $sum: {
              $cond: [{ $eq: ["$method", "cash"] }, "$amount", 0],
            },
          },
          bankTotal: {
            $sum: {
              $cond: [{ $eq: ["$method", "bank_transfer"] }, "$amount", 0],
            },
          },
          momoMtnTotal: {
            $sum: {
              $cond: [{ $eq: ["$method", "mobile_money_mtn"] }, "$amount", 0],
            },
          },
          momoOrangeTotal: {
            $sum: {
              $cond: [{ $eq: ["$method", "mobile_money_orange"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    return res.json({
      currency: "XAF",
      from,
      to,
      summary: revenue[0] || {
        totalRevenue: 0,
        paymentCount: 0,
        cashTotal: 0,
        bankTotal: 0,
        momoMtnTotal: 0,
        momoOrangeTotal: 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const sendPaymentReminder = async (req: Request, res: Response) => {
  try {
    const { studentId, channels, phoneNumber, customMessage } = req.body;

    const student = await User.findById(studentId).populate(
      "parentId",
      "name email role parentLanguagePreference schoolSection uiLanguagePreference"
    );
    if (!student || student.role !== "student") {
      return res.status(404).json({ message: "Student not found" });
    }

    const schoolSettings = await getEffectiveSchoolSettings();

    const overdueInvoices = await Invoice.find({
      student: student._id,
      balance: { $gt: 0 },
      status: { $in: ["issued", "partially_paid", "overdue"] },
      dueDate: { $lt: new Date() },
    });

    const totalOutstanding = overdueInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.balance || 0),
      0
    );

    if (totalOutstanding <= 0) {
      return res.status(400).json({ message: "No outstanding overdue balance for this student" });
    }

    const result: any = {
      email: { attempted: false, status: "skipped", recipient: null as string | null, error: null as string | null },
      sms: {
        attempted: false,
        status: "skipped",
        recipient: null as string | null,
        error: null as string | null,
        providerMessageId: null as string | null,
        smsLogId: null as string | null,
      },
    };

    if (channels.includes("email")) {
      const parentEmail = (student.parentId as any)?.email || null;
      const recipientEmail = parentEmail || student.email;
      const recipientUser = parentEmail
        ? (student.parentId as any)
        : student;
      const recipientLanguage = resolveUserLanguage({
        role: recipientUser.role,
        schoolLanguageMode: schoolSettings.schoolLanguageMode,
        schoolSection: recipientUser.schoolSection,
        parentLanguagePreference: recipientUser.parentLanguagePreference,
        uiLanguagePreference: recipientUser.uiLanguagePreference,
        schoolPreferredLanguage: schoolSettings.preferredLanguage,
      });
      const localizedTemplate = buildPaymentReminderTemplate({
        studentName: student.name,
        totalOutstanding,
        language: recipientLanguage,
      });
      const message = customMessage || localizedTemplate.text;

      result.email.attempted = true;
      result.email.recipient = recipientEmail;

      if (!recipientEmail) {
        result.email.status = "failed";
        result.email.error = "No recipient email found";
      } else {
        const emailRes = await sendTransactionalEmail({
          recipientEmail,
          recipientUserId: (student.parentId as any)?._id || student._id,
          subject: localizedTemplate.subject,
          html: customMessage
            ? `<p>${customMessage}</p>`
            : localizedTemplate.html,
          text: message,
          template: "payment_reminder",
          eventType: "payment_reminder",
          relatedEntityType: "Student",
          relatedEntityId: student._id,
          metadata: {
            studentId: String(student._id),
            totalOutstanding,
            invoiceCount: overdueInvoices.length,
            language: recipientLanguage,
          },
        });

        result.email.status = emailRes.status;
        result.email.error = emailRes.error || null;
      }
    }

    if (channels.includes("sms")) {
      result.sms.attempted = true;
      result.sms.recipient = phoneNumber || null;

      const smsRecipientUser = (student.parentId as any)?.email
        ? (student.parentId as any)
        : student;
      const recipientLanguage = resolveUserLanguage({
        role: smsRecipientUser.role,
        schoolLanguageMode: schoolSettings.schoolLanguageMode,
        schoolSection: smsRecipientUser.schoolSection,
        parentLanguagePreference: smsRecipientUser.parentLanguagePreference,
        uiLanguagePreference: smsRecipientUser.uiLanguagePreference,
        schoolPreferredLanguage: schoolSettings.preferredLanguage,
      });
      const localizedTemplate = buildPaymentReminderTemplate({
        studentName: student.name,
        totalOutstanding,
        language: recipientLanguage,
      });
      const smsMessage = customMessage || localizedTemplate.sms;

      if (!phoneNumber) {
        result.sms.status = "failed";
        result.sms.error = "phoneNumber is required for SMS reminders";
      } else {
        const smsRes = await sendSms({ to: phoneNumber, message: smsMessage });
        result.sms.status = smsRes.status;
        result.sms.error = smsRes.error || null;
        result.sms.providerMessageId = smsRes.providerMessageId || null;

        const smsLog = await SmsLog.create({
          recipientPhone: phoneNumber,
          recipientUser: (student.parentId as any)?._id || student._id,
          message: smsMessage,
          eventType: "payment_reminder",
          status: smsRes.status === "sent" ? "sent" : "failed",
          providerMessageId: smsRes.providerMessageId || null,
          errorMessage: smsRes.error || null,
          metadata: {
            studentId: String(student._id),
            totalOutstanding,
            invoiceCount: overdueInvoices.length,
            language: recipientLanguage,
          },
          relatedEntityType: "Student",
          relatedEntityId: student._id,
        });

        result.sms.smsLogId = String(smsLog._id);
      }
    }

    await logActivity({
      userId: (req as any).user._id,
      action: `Sent finance reminder for student ${student.name}`,
    });

    return res.json({
      message: "Reminder processed",
      student: { _id: student._id, name: student.name, email: student.email },
      totalOutstanding,
      invoiceCount: overdueInvoices.length,
      result,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getSmsStatus = async (req: Request, res: Response) => {
  try {
    const msgId = String(req.params.msgId);

    const statusRes = await getSmsDeliveryStatus(msgId);

    if (statusRes.status !== "ok") {
      return res.status(400).json(statusRes);
    }

    const providerStatusRaw = String(statusRes.providerStatus || "").toLowerCase();
    const mappedStatus = providerStatusRaw.includes("deliv")
      ? "delivered"
      : providerStatusRaw.includes("fail") || providerStatusRaw.includes("error")
        ? "failed"
        : "sent";

    const smsLog = await SmsLog.findOneAndUpdate(
      { providerMessageId: msgId },
      {
        status: mappedStatus,
        providerStatus: statusRes.providerStatus || null,
        statusCheckedAt: new Date(),
        lastProviderPayload: statusRes.raw || null,
      },
      { new: true }
    );

    if (mappedStatus === "delivered") {
      emitSmsDelivered({
        msgId,
        smsLogId: smsLog ? String(smsLog._id) : undefined,
      });
    }

    return res.json({
      msgId,
      providerStatus: statusRes.providerStatus,
      mappedStatus,
      smsLog,
      raw: statusRes.raw,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const downloadPaymentReceiptPdf = async (req: Request, res: Response) => {
  try {
    const { schoolName, schoolMotto, schoolLogoUrl } = await getEffectiveSchoolSettings();

    const payment = await Payment.findById(req.params.id)
      .populate("student", "name email")
      .populate("invoice", "invoiceNumber totalAmount amountPaid balance dueDate")
      .populate("receivedBy", "name");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const filename = `receipt-${payment.receiptNumber}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    if (schoolLogoUrl) {
      try {
        doc.image(schoolLogoUrl, 40, 36, { fit: [56, 56] });
      } catch {
        // Keep rendering if logo cannot be loaded.
      }
    }

    doc.fontSize(20).text(`${schoolName} - Recu de Paiement`, { align: "center" });
    doc.fontSize(10).fillColor("#6b7280").text(schoolMotto, { align: "center" });
    doc.fillColor("#000000");
    doc.moveDown();
    doc.fontSize(11);

    doc.text(`Recu No: ${payment.receiptNumber}`);
    doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString("fr-CM")}`);
    doc.text(`Devise: XAF (FCFA)`);
    doc.moveDown();

    doc.fontSize(13).text("Details Eleve", { underline: true });
    doc.fontSize(11);
    doc.text(`Nom: ${(payment.student as any)?.name || "N/A"}`);
    doc.text(`Email: ${(payment.student as any)?.email || "N/A"}`);
    doc.moveDown();

    doc.fontSize(13).text("Facture", { underline: true });
    doc.fontSize(11);
    doc.text(`Facture No: ${(payment.invoice as any)?.invoiceNumber || "N/A"}`);
    doc.text(`Montant facture: ${Number((payment.invoice as any)?.totalAmount || 0).toLocaleString("fr-CM")} XAF`);
    doc.text(`Montant deja paye: ${Number((payment.invoice as any)?.amountPaid || 0).toLocaleString("fr-CM")} XAF`);
    doc.text(`Solde actuel: ${Number((payment.invoice as any)?.balance || 0).toLocaleString("fr-CM")} XAF`);
    doc.moveDown();

    doc.fontSize(13).text("Paiement", { underline: true });
    doc.fontSize(11);
    doc.text(`Montant encaisse: ${Number(payment.amount).toLocaleString("fr-CM")} XAF`);
    doc.text(`Methode: ${payment.method}`);
    doc.text(`Reference transaction: ${payment.transactionReference || "-"}`);
    doc.text(`Encaisse par: ${(payment.receivedBy as any)?.name || "N/A"}`);
    doc.moveDown(2);

    doc.text("Signature caisse: ______________________", { align: "left" });
    doc.moveDown();
    doc.fontSize(9).fillColor("#6b7280").text(`Document genere automatiquement par ${schoolName}`, {
      align: "center",
    });

    doc.end();
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};
