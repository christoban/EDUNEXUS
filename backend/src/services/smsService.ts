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
  provider: (process.env.SMS_PROVIDER || "africastalking").toLowerCase(),
  apiUrl:
    process.env.SMS_API_URL ||
    "https://api.africastalking.com/version1/messaging",
  apiKey: process.env.SMS_API_KEY,
  username: process.env.SMS_USERNAME || "sandbox",
  senderId: process.env.SMS_SENDER_ID || "EDUNEXUS",
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
