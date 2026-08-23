import axios from "axios";

const BASE_URL = process.env.TECHSOFT_BASE_URL || "https://app.techsoft-sms.com/api/http";
const API_KEY = process.env.TECHSOFT_API_KEY || "";
const SENDER_ID = process.env.TECHSOFT_SENDER_ID || "TechSoft";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s+]/g, "");
  return digits.startsWith("237") ? digits : `237${digits}`;
}

// ─── ENVOYER UN SMS ──────────────────────────────────────────
export const sendSMS = async (to: string, message: string): Promise<{ success: boolean; msgId?: string; error?: string }> => {
  try {
    const response = await axios.post(`${BASE_URL}/sms/send`, {
      api_token: API_KEY,
      recipient: normalizePhone(to),
      sender_id: SENDER_ID,
      type: "plain",
      message,
    }, {
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    });

    const data = response.data;
    if (data.status === "success") {
      const uid = Array.isArray(data.data) ? data.data[0]?.uid : data.data?.uid;
      return { success: true, msgId: uid };
    }
    return { success: false, error: data.message || "Erreur inconnue" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ─── ENVOYER SMS EN MASSE (max 100 numéros par lot) ──────────
export const sendBulkSMS = async (numbers: string[], message: string): Promise<{ success: number; failed: number }> => {
  const chunks: string[][] = [];
  for (let i = 0; i < numbers.length; i += 100) {
    chunks.push(numbers.slice(i, i + 100));
  }

  let success = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const recipient = chunk.map(normalizePhone).join(",");

    try {
      const response = await axios.post(`${BASE_URL}/sms/send`, {
        api_token: API_KEY,
        recipient,
        sender_id: SENDER_ID,
        type: "plain",
        message,
      }, {
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
      });

      const data = response.data;
      if (data.status === "success") {
        const sent = Array.isArray(data.data) ? data.data.length : 1;
        success += sent;
      } else {
        failed += chunk.length;
      }
    } catch {
      failed += chunk.length;
    }
  }

  return { success, failed };
};

// ─── PARSER SMS PRÉSENCES ────────────────────────────────────
export type ParsedAttendance = {
  className: string;
  phoneNumber: string;
  records: { index: number; status: "PRESENT" | "ABSENT" }[];
  rawMessage: string;
};

export const parseSMSAttendance = (message: string, senderPhone: string): ParsedAttendance | null => {
  try {
    const parts = message.trim().toUpperCase().split("#");
    if (parts.length < 3 || parts[0] !== "PRES") return null;

    const className = parts[1];
    const statusList = parts[2].split(",");

    const records = statusList.map((status, index) => ({
      index,
      status: status.trim() === "1" ? "PRESENT" as const : "ABSENT" as const,
    }));

    return {
      className,
      phoneNumber: senderPhone,
      records,
      rawMessage: message,
    };
  } catch {
    return null;
  }
};

// ─── TRAITEMENT SMS ENTRANT ──────────────────────────────────
export const processSMSAttendance = async (
  message: string,
  senderPhone: string,
  schoolId: string,
  prisma: any
): Promise<{ success: boolean; message: string }> => {
  const parsed = parseSMSAttendance(message, senderPhone);

  if (!parsed) {
    return { success: false, message: "Format SMS invalide. Utilisez: PRES#CLASSE#1,0,1,..." };
  }

  const cls = await prisma.class.findFirst({
    where: {
      schoolId,
      name: { contains: parsed.className, mode: "insensitive" },
    },
    include: {
      students: {
        include: { user: true },
        orderBy: { user: { lastName: "asc" } },
      },
    },
  });

  if (!cls) {
    return { success: false, message: `Classe "${parsed.className}" introuvable` };
  }

  const students = cls.students;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const teacher = await prisma.user.findFirst({
    where: { schoolId, phone: { contains: senderPhone.replace("237", "") } },
  });

  const attendanceRecords = parsed.records
    .filter((record) => record.index < students.length)
    .map((record) => ({
      schoolId,
      studentId: students[record.index].userId,
      classId: cls.id,
      date: today,
      status: record.status,
      period: "MORNING" as const,
      recordedById: teacher?.id,
      isOfflineSync: false,
    }));

  for (const record of attendanceRecords) {
    const existing = await prisma.attendance.findFirst({
      where: {
        schoolId,
        studentId: record.studentId,
        classId: record.classId,
        date: today,
        period: record.period,
      },
    });

    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: record.status,
          recordedById: record.recordedById,
          teacherId: teacher?.id ?? null,
        },
      });
    } else {
      await prisma.attendance.create({
        data: {
          ...record,
          academicPeriodId: null,
          subjectId: null,
          teacherId: teacher?.id ?? null,
          syncedAt: new Date(),
        },
      });
    }
  }

  return {
    success: true,
    message: `✅ ${attendanceRecords.length} présences enregistrées pour ${cls.name}`,
  };
};

// ─── TYPES ───────────────────────────────────────────────────
type SendSmsInput = {
  to: string;
  message: string;
};

type SendSmsResult = {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

// ─── VÉRIFIER CONFIGURATION SMS ──────────────────────────────
export const isSmsConfigured = () => Boolean(API_KEY);

// ─── ENVOYER SMS (API secondaire compatible hexagonal) ───────
export const sendSms = async (input: SendSmsInput): Promise<SendSmsResult> => {
  if (!isSmsConfigured()) {
    return { status: "failed", error: "SMS API key is missing" };
  }

  try {
    const response = await axios.post(`${BASE_URL}/sms/send`, {
      api_token: API_KEY,
      recipient: normalizePhone(input.to),
      sender_id: SENDER_ID,
      type: "plain",
      message: input.message,
    }, {
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    });

    const data = response.data;

    if (data.status === "success") {
      const uid = Array.isArray(data.data) ? data.data[0]?.uid : data.data?.uid;
      return { status: "sent", providerMessageId: uid ? String(uid) : undefined };
    }

    return {
      status: "failed",
      error: data.message || "Echec d'envoi TechSoft",
    };
  } catch (error: any) {
    return { status: "failed", error: error?.message || "Unknown SMS error" };
  }
};

// ─── STATUT DE LIVRAISON SMS ─────────────────────────────────
export const getSmsDeliveryStatus = async (providerMessageId: string) => {
  if (!isSmsConfigured()) {
    return { status: "failed", error: "SMS API key is missing" };
  }

  try {
    // GET /sms/{uid} — api_token envoyé dans le corps JSON selon la doc TechSoft
    const response = await axios.get(`${BASE_URL}/sms/${providerMessageId}`, {
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      data: { api_token: API_KEY },
    });

    const data = response.data;

    if (data.status === "success") {
      return {
        status: "ok",
        providerStatus: data.data?.status || data.data?.delivery_status,
        raw: data,
      };
    }

    return {
      status: "failed",
      error: data.message || "Erreur récupération statut",
      raw: data,
    };
  } catch (error: any) {
    return {
      status: "failed",
      error: error?.message || "Unknown SMS status error",
    };
  }
};
