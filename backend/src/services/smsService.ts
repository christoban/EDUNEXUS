type SendSmsInput = {
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
