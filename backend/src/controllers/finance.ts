import { type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { getSmsDeliveryStatus, sendSms } from "../services/smsService.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { resolveUserLanguage } from "../utils/languageHelper.ts";
import { buildPaymentReminderTemplate } from "../utils/emailTemplates.ts";
import { emitSmsDelivered } from "../socket/io.ts";

const asDate = (value?: string) => (value ? new Date(value) : undefined);

const generateReceiptNumber = () =>
  `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100000 + Math.random() * 900000)}`;

const getPagination = (req: Request, defaultLimit = 20) => {
  const query = ((req as any).validatedQuery || req.query) as any;
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
};

const getSchoolId = (req: Request) => (req as any).user.schoolId as string;

const getInvoiceStatus = (amount: number, amountPaid: number, dueDate?: Date | null) => {
  const balance = Math.max(amount - amountPaid, 0);
  if (balance === 0) return { status: "PAID" as const, balance };
  if (amountPaid > 0) return { status: "PARTIAL" as const, balance };
  if (dueDate && dueDate.getTime() < Date.now()) return { status: "OVERDUE" as const, balance };
  return { status: "PENDING" as const, balance };
};

const loadInvoiceTotals = async (invoiceId: string) => {
  const payments = await prisma.payment.findMany({ where: { invoiceId }, orderBy: { createdAt: "desc" } });
  const amountPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return { payments, amountPaid };
};

export const createFeePlan = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const feePlan = await prisma.feePlan.create({
      data: {
        schoolId,
        name: String(req.body.name || "").trim(),
        amount: Number(req.body.amount || 0),
        currency: req.body.currency || "XAF",
        description: req.body.description || null,
      },
    });

    await logActivity({ userId: (req as any).user.userId, schoolId, action: `Created fee plan: ${feePlan.name}` });
    return res.status(201).json(feePlan);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getFeePlans = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const query = ((req as any).validatedQuery || req.query) as any;
    const { page, limit, skip } = getPagination(req, 20);

    const where = {
      schoolId,
      ...(query.category ? { description: { contains: String(query.category), mode: "insensitive" as const } } : {}),
    };

    const [total, feePlans] = await Promise.all([
      prisma.feePlan.count({ where }),
      prisma.feePlan.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    ]);

    return res.json({ feePlans, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const updateFeePlan = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const feePlan = await prisma.feePlan.findFirst({ where: { id: String(req.params.id), schoolId } });
    if (!feePlan) return res.status(404).json({ message: "Fee plan not found" });

    const updated = await prisma.feePlan.update({
      where: { id: feePlan.id },
      data: {
        ...req.body,
        ...(req.body.amount !== undefined ? { amount: Number(req.body.amount) } : {}),
      },
    });

    await logActivity({ userId: (req as any).user.userId, schoolId, action: `Updated fee plan: ${updated.name}` });
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const deleteFeePlan = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const feePlan = await prisma.feePlan.findFirst({ where: { id: String(req.params.id), schoolId } });
    if (!feePlan) return res.status(404).json({ message: "Fee plan not found" });

    await prisma.feePlan.delete({ where: { id: feePlan.id } });
    await logActivity({ userId: (req as any).user.userId, schoolId, action: `Deleted fee plan: ${feePlan.name}` });
    return res.json({ message: "Fee plan deleted" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const studentId = String(req.body.studentId || "").trim();
    if (!studentId) return res.status(400).json({ message: "studentId is required" });

    const amount = Number(req.body.amount || 0);
    const dueDate = asDate(req.body.dueDate);

    const invoice = await prisma.invoice.create({
      data: {
        schoolId,
        studentId,
        feePlanId: req.body.feePlanId ? String(req.body.feePlanId) : null,
        amount,
        currency: req.body.currency || "XAF",
        dueDate: dueDate || null,
        status: getInvoiceStatus(amount, 0, dueDate).status,
        description: req.body.description || null,
      },
    });

    await logActivity({ userId: (req as any).user.userId, schoolId, action: `Created invoice ${invoice.id}` });
    return res.status(201).json(invoice);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const createInvoicesFromFeePlan = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { feePlanId, dueDate, classId, studentId, notes } = req.body;

    const feePlan = await prisma.feePlan.findFirst({ where: { id: String(feePlanId), schoolId } });
    if (!feePlan) return res.status(404).json({ message: "Fee plan not found" });

    const students = await prisma.user.findMany({
      where: {
        schoolId,
        role: "student",
        isActive: true,
        ...(studentId ? { id: String(studentId) } : {}),
        ...(classId ? { studentProfile: { classId: String(classId) } } : {}),
      },
      select: { id: true },
    });

    if (!students.length) return res.status(400).json({ message: "No students matched for invoice generation" });

    const invoices = [] as Array<{ id: string }>;
    for (const student of students) {
      invoices.push(
        await prisma.invoice.create({
          data: {
            schoolId,
            studentId: student.id,
            feePlanId: feePlan.id,
            amount: feePlan.amount,
            currency: feePlan.currency,
            dueDate: asDate(dueDate) || null,
            status: "PENDING",
            description: notes || feePlan.description || feePlan.name,
          },
        })
      );
    }

    await logActivity({ userId: (req as any).user.userId, schoolId, action: `Generated ${invoices.length} invoices from fee plan ${feePlan.name}` });
    return res.status(201).json({ message: "Invoices generated", count: invoices.length, invoices });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const query = ((req as any).validatedQuery || req.query) as any;
    const { page, limit, skip } = getPagination(req, 20);

    const where = {
      schoolId,
      ...(query.studentId ? { studentId: String(query.studentId) } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.classId ? { student: { studentProfile: { classId: String(query.classId) } } } : {}),
      ...(query.dueBefore ? { dueDate: { lte: new Date(query.dueBefore) } } : {}),
    } as any;

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: { feePlan: true, payments: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return res.json({ invoices, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const invoice = await prisma.invoice.findFirst({
      where: { id: String(req.params.id), schoolId },
      include: { feePlan: true, payments: { orderBy: { createdAt: "desc" } } },
    });

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    return res.json(invoice);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const recordPayment = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const invoiceId = String(req.body.invoiceId || req.params.invoiceId || "");
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, schoolId } });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const amount = Number(req.body.amount || 0);
    const paidAt = asDate(req.body.paidAt) || new Date();

    const payment = await prisma.payment.create({
      data: {
        schoolId,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amount,
        currency: req.body.currency || invoice.currency,
        method: req.body.method || "CASH",
        status: req.body.status || "SUCCESS",
        transactionId: req.body.transactionId || null,
        receiptUrl: req.body.receiptUrl || null,
        paidAt,
      },
    });

    const totals = await loadInvoiceTotals(invoice.id);
    const status = getInvoiceStatus(Number(invoice.amount || 0), totals.amountPaid, invoice.dueDate);

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: status.status } });
    await logActivity({ userId: (req as any).user.userId, schoolId, action: `Recorded payment for invoice ${invoice.id}` });

    return res.status(201).json(payment);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const query = ((req as any).validatedQuery || req.query) as any;
    const { page, limit, skip } = getPagination(req, 20);

    const where = {
      schoolId,
      ...(query.studentId ? { studentId: String(query.studentId) } : {}),
      ...(query.invoiceId ? { invoiceId: String(query.invoiceId) } : {}),
      ...(query.method ? { method: query.method } : {}),
    } as any;

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({ where, include: { invoice: true }, orderBy: { createdAt: "desc" }, skip, take: limit }),
    ]);

    return res.json({ payments, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const expense = await prisma.expense.create({
      data: {
        schoolId,
        label: String(req.body.label || req.body.title || "").trim(),
        amount: Number(req.body.amount || 0),
        currency: req.body.currency || "XAF",
        category: req.body.category || null,
        date: asDate(req.body.date) || new Date(),
        createdById: (req as any).user.userId,
      },
    });

    await logActivity({ userId: (req as any).user.userId, schoolId, action: `Recorded expense: ${expense.label}` });
    return res.status(201).json(expense);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const query = ((req as any).validatedQuery || req.query) as any;
    const { page, limit, skip } = getPagination(req, 20);

    const where = {
      schoolId,
      ...(query.category ? { category: String(query.category) } : {}),
    };

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({ where, orderBy: { date: "desc" }, skip, take: limit }),
    ]);

    return res.json({ expenses, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getOverdueStudents = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const invoices = await prisma.invoice.findMany({
      where: { schoolId, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] }, dueDate: { lt: new Date() } },
      include: { payments: true },
    });

    const studentMap = new Map<string, { totalDue: number; totalPaid: number; overdueCount: number }>();
    for (const invoice of invoices) {
      const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const entry = studentMap.get(invoice.studentId) || { totalDue: 0, totalPaid: 0, overdueCount: 0 };
      entry.totalDue += Number(invoice.amount || 0);
      entry.totalPaid += paid;
      entry.overdueCount += 1;
      studentMap.set(invoice.studentId, entry);
    }

    const studentIds = [...studentMap.keys()];
    const students = await prisma.user.findMany({ where: { schoolId, id: { in: studentIds } }, select: { id: true, name: true, email: true } });
    const results = students.map((student) => {
      const stats = studentMap.get(student.id)!;
      return { student, ...stats, balance: Math.max(stats.totalDue - stats.totalPaid, 0) };
    });

    return res.json({ students: results, total: results.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getClassSchedule = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const query = ((req as any).validatedQuery || req.query) as any;

    const invoices = await prisma.invoice.findMany({
      where: {
        schoolId,
        ...(query.classId ? { student: { studentProfile: { classId: String(query.classId) } } } : {}),
      } as any,
    });

    const summary = invoices.reduce(
      (acc, invoice) => {
        acc.totalInvoices += 1;
        acc.totalAmount += Number(invoice.amount || 0);
        return acc;
      },
      { totalInvoices: 0, totalAmount: 0 }
    );

    return res.json(summary);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getRevenueByPeriod = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const query = ((req as any).validatedQuery || req.query) as any;
    const from = asDate(query.from);
    const to = asDate(query.to);

    const payments = await prisma.payment.findMany({
      where: {
        schoolId,
        ...(from || to ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
    });

    const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return res.json({ totalRevenue, paymentsCount: payments.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const sendPaymentReminder = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const invoice = await prisma.invoice.findFirst({ where: { id: String(req.params.invoiceId || req.body.invoiceId), schoolId }, include: { payments: true } });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const student = await prisma.user.findFirst({ where: { id: invoice.studentId, schoolId }, include: { parentProfile: true } });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const effectiveSettings = await getEffectiveSchoolSettings(schoolId);
    const language = resolveUserLanguage(student, effectiveSettings);
    const dueAmount = Math.max(Number(invoice.amount || 0) - invoice.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0), 0);
    const reminder = buildPaymentReminderTemplate({ studentName: student.name, amountDue: dueAmount, dueDate: invoice.dueDate?.toISOString(), language });

    let smsLogId: string | undefined;
    if (student.phoneNumber) {
      const smsResult = await sendSms(student.phoneNumber, reminder.sms);
      const smsLog = await prisma.smsLog.create({
        data: {
          schoolId,
          to: student.phoneNumber,
          content: reminder.sms,
          status: smsResult.success ? "sent" : "failed",
          provider: smsResult.provider || null,
        },
      });
      smsLogId = smsLog.id;
      emitSmsDelivered({ smsLogId, to: student.phoneNumber, status: smsResult.success ? "sent" : "failed" });
    }

    if (student.email) {
      await sendTransactionalEmail({
        to: student.email,
        subject: reminder.email.subject,
        html: reminder.email.html,
        text: reminder.email.text,
      });
    }

    await logActivity({ userId: (req as any).user.userId, schoolId, action: `Sent payment reminder for invoice ${invoice.id}` });
    return res.json({ success: true, smsLogId, message: "Reminder sent" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getSmsStatus = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const smsLog = await prisma.smsLog.findFirst({ where: { id: String(req.params.id), schoolId } });
    if (!smsLog) return res.status(404).json({ message: "SMS log not found" });

    const status = await getSmsDeliveryStatus(smsLog.id);
    return res.json({ smsLog, status });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const downloadPaymentReceiptPdf = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const invoice = await prisma.invoice.findFirst({ where: { id: String(req.params.id), schoolId }, include: { payments: { orderBy: { createdAt: "desc" } } } });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const payment = invoice.payments[0];
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const doc = new PDFDocument({ margin: 50 });
    const receiptNumber = generateReceiptNumber();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${receiptNumber}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text("Payment Receipt", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Receipt: ${receiptNumber}`);
    doc.text(`Invoice: ${invoice.id}`);
    doc.text(`Student: ${invoice.studentId}`);
    doc.text(`Amount Paid: ${payment.amount} ${payment.currency}`);
    doc.text(`Payment Method: ${payment.method}`);
    doc.text(`Payment Date: ${payment.paidAt?.toISOString() || payment.createdAt.toISOString()}`);
    doc.end();
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};