import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getSocketClient } from "@/lib/socket";

export type SmsLiveStatus = "checking" | "sent" | "delivered" | "failed";

type SmsDeliveredPayload = {
  msgId?: string;
  smsLogId?: string;
};

export const useSmsDeliveryStatus = () => {
  const [statusByMsgId, setStatusByMsgId] = useState<Record<string, SmsLiveStatus>>({});
  const pollingTimersRef = useRef<Record<string, number>>({});

  const clearPolling = useCallback((msgId: string) => {
    const timer = pollingTimersRef.current[msgId];
    if (timer) {
      window.clearInterval(timer);
      delete pollingTimersRef.current[msgId];
    }
  }, []);

  const refreshStatus = useCallback(async (msgId: string) => {
    setStatusByMsgId((prev) => ({ ...prev, [msgId]: "checking" }));

    try {
      const { data } = await api.get(`/finance/sms/status/${encodeURIComponent(msgId)}`);
      const mappedStatus = String(data?.mappedStatus || "sent").toLowerCase();
      const nextStatus: SmsLiveStatus =
        mappedStatus === "delivered"
          ? "delivered"
          : mappedStatus === "failed"
            ? "failed"
            : "sent";

      setStatusByMsgId((prev) => ({ ...prev, [msgId]: nextStatus }));

      if (nextStatus === "delivered" || nextStatus === "failed") {
        clearPolling(msgId);
      }

      return nextStatus;
    } catch {
      setStatusByMsgId((prev) => ({ ...prev, [msgId]: "failed" }));
      clearPolling(msgId);
      return "failed" as SmsLiveStatus;
    }
  }, [clearPolling]);

  const startTracking = useCallback((msgId: string) => {
    if (!msgId) return;

    setStatusByMsgId((prev) => ({ ...prev, [msgId]: prev[msgId] || "sent" }));

    if (pollingTimersRef.current[msgId]) return;

    let attempts = 0;

    const runPolling = async () => {
      attempts += 1;
      const status = await refreshStatus(msgId);
      if (status === "delivered" || status === "failed" || attempts >= 18) {
        clearPolling(msgId);
      }
    };

    void runPolling();

    pollingTimersRef.current[msgId] = window.setInterval(() => {
      void runPolling();
    }, 10000);
  }, [clearPolling, refreshStatus]);

  useEffect(() => {
    const socket = getSocketClient();

    const handleDelivered = (payload: SmsDeliveredPayload) => {
      if (!payload?.msgId) return;
      const msgId = payload.msgId;
      setStatusByMsgId((prev) => ({ ...prev, [msgId]: "delivered" }));
      clearPolling(msgId);
    };

    socket.on("sms_delivered", handleDelivered);

    return () => {
      socket.off("sms_delivered", handleDelivered);
      Object.keys(pollingTimersRef.current).forEach((msgId) => {
        clearPolling(msgId);
      });
    };
  }, [clearPolling]);

  return {
    statusByMsgId,
    startTracking,
    refreshStatus,
  };
};
