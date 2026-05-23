import axios from "axios";

const BASE_URL = process.env.TECHSOFT_BASE_URL || "https://app.techsoft-web-agency.com/sms/api";
const API_KEY = process.env.TECHSOFT_API_KEY || "";
const SENDER_ID = process.env.TECHSOFT_SENDER_ID || "TECHSOF-SMS";

// ─── ENVOYER UN SMS ──────────────────────────────────────────
export const sendSMS = async (to: string, message: string): Promise<{ success: boolean; msgId?: string; error?: string }> => {
  try {
    const phone = to.replace(/\s+/g, "").replace(/^\+/, "");
    const normalized = phone.startsWith("237") ? phone : `237${phone}`;

    const params = new URLSearchParams({
      action: "send-sms",
      api_key: API_KEY,
      to: normalized,
      from: SENDER_ID,
      sms: message,
    });

    const response = await axios.get(`${BASE_URL}?${params.toString()}`);
    const data = response.data;

    if (data.code === "ok") {
      return { success: true, msgId: data.msgId };
    }

    return { success: false, error: data.message || "Erreur inconnue" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ─── ENVOYER SMS EN MASSE (max 100 numéros) ──────────────────
export const sendBulkSMS = async (numbers: string[], message: string): Promise<{ success: number; failed: number }> => {
  const chunks: string[][] = [];
  for (let index = 0; index < numbers.length; index += 100) {
    chunks.push(numbers.slice(index, index + 100));
  }

  let success = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const normalized = chunk
      .map((n) => n.replace(/\s+/g, "").replace(/^\+/, ""))
      .map((n) => (n.startsWith("237") ? n : `237${n}`))
      .join(",");

    const params = new URLSearchParams({
      action: "send-sms",
      api_key: API_KEY,
      to: normalized,
      from: SENDER_ID,
      sms: message,
    });

    try {
      const response = await axios.get(`${BASE_URL}?${params.toString()}`);
      const results = Array.isArray(response.data) ? response.data : [response.data];
      results.forEach((result: any) => {
        if (result.code === "ok") success += 1;
        else failed += 1;
      });
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
};type SendSmsInput = {
  to: string;
  message: string;
};

type SendSmsResult = {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

const getSmsConfig = () => ({
  provider: (process.env.SMS_PROVIDER || "techsoft").toLowerCase(),
  apiUrl: process.env.TECHSOFT_BASE_URL || "https://app.techsoft-web-agency.com/sms/api",
  apiKey: process.env.TECHSOFT_API_KEY,
  username: process.env.SMS_USERNAME || "sandbox",
  senderId: process.env.TECHSOFT_SENDER_ID || "EDUNEXUS",
});

export const isSmsConfigured = () => {
  const { apiKey } = getSmsConfig();
  return Boolean(apiKey);
};

const parseAfricasTalkingResponse = (payload: any) => {
  const smsData = payload?.SMSMessageData;
  const recipients = smsData?.Recipients;
  if (Array.isArray(recipients) && recipients.length > 0) {
    return {
      providerMessageId: String(recipients[0]?.messageId || recipients[0]?.messageID || ""),
    };
  }
  return { providerMessageId: payload?.messageId || payload?.id };
};

const parseTechsoftResponse = (payload: any) => {
  const providerMessageId =
    payload?.msgId ||
    payload?.messageId ||
    payload?.messageID ||
    payload?.id ||
    payload?.data?.msgId;

  const normalizedStatus = String(payload?.status || payload?.state || "").toLowerCase();
  const hasFailure =
    normalizedStatus.includes("fail") ||
    normalizedStatus.includes("error") ||
    Boolean(payload?.error) ||
    Boolean(payload?.errors);

  return {
    providerMessageId: providerMessageId ? String(providerMessageId) : undefined,
    failed: hasFailure,
    errorMessage:
      payload?.message || payload?.error || payload?.errors?.[0] || "Techsoft SMS error",
  };
};

export const sendSms = async (input: SendSmsInput): Promise<SendSmsResult> => {
  try {
    if (!isSmsConfigured()) {
      return { status: "failed", error: "SMS API key is missing" };
    }

    const config = getSmsConfig();

    if (config.provider === "africastalking") {
      const body = new URLSearchParams({
        username: config.username,
        to: input.to,
        message: input.message,
      });

      if (config.senderId) {
        body.set("from", config.senderId);
      }

      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          apiKey: String(config.apiKey),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          status: "failed",
          error:
            payload?.errorMessage ||
            payload?.message ||
            `Africa's Talking SMS error (${response.status})`,
        };
      }

      return {
        status: "sent",
        ...parseAfricasTalkingResponse(payload),
      };
    }

    if (config.provider === "techsoft") {
      const url = new URL(String(config.apiUrl));
      url.searchParams.set("action", "send-sms");
      url.searchParams.set("api_key", String(config.apiKey));
      url.searchParams.set("to", input.to);
      url.searchParams.set("sms", input.message);

      if (config.senderId) {
        url.searchParams.set("from", config.senderId);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          status: "failed",
          error:
            payload?.message ||
            payload?.error ||
            `Techsoft SMS error (${response.status})`,
        };
      }

      const parsed = parseTechsoftResponse(payload);

      if (parsed.failed) {
        return {
          status: "failed",
          error: parsed.errorMessage,
          providerMessageId: parsed.providerMessageId,
        };
      }

      return {
        status: "sent",
        providerMessageId: parsed.providerMessageId,
      };
    }

    const response = await fetch(String(config.apiUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        to: input.to,
        message: input.message,
        senderId: config.senderId,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        status: "failed",
        error: payload?.message || `SMS provider error (${response.status})`,
      };
    }

    return {
      status: "sent",
      providerMessageId: payload?.messageId || payload?.id,
    };
  } catch (error: any) {
    return {
      status: "failed",
      error: error?.message || "Unknown SMS error",
    };
  }
};

export const getSmsDeliveryStatus = async (providerMessageId: string) => {
  const config = getSmsConfig();

  if (config.provider !== "techsoft") {
    return {
      status: "unsupported",
      error: "SMS status polling is currently supported only for Techsoft",
    };
  }

  if (!isSmsConfigured()) {
    return {
      status: "failed",
      error: "SMS API key is missing",
    };
  }

  try {
    const url = new URL(String(config.apiUrl));
    url.searchParams.set("action", "sms-status");
    url.searchParams.set("api_key", String(config.apiKey));
    url.searchParams.set("sms_uid", providerMessageId);

    const response = await fetch(url.toString(), { method: "GET" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        status: "failed",
        error:
          payload?.message ||
          payload?.error ||
          `Techsoft status error (${response.status})`,
        raw: payload,
      };
    }

    return {
      status: "ok",
      providerStatus: payload?.status || payload?.state || payload?.deliveryStatus,
      raw: payload,
    };
  } catch (error: any) {
    return {
      status: "failed",
      error: error?.message || "Unknown SMS status error",
    };
  }
};
