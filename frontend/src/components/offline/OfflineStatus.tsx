import { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { flushOfflineQueue, getOfflineQueueSize } from "@/lib/offlineSync";

const OfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);

    const syncNow = async () => {
      setSyncing(true);
      try {
        const results = await flushOfflineQueue();
        const successCount = results.filter((result) => result.ok).length;
        if (successCount > 0) {
          toast.success(`${successCount} action(s) synchronisée(s)`);
        }
      } finally {
        setSyncing(false);
        setQueueSize(await getOfflineQueueSize());
      }
    };

    const handleOnline = () => {
      updateStatus();
      void syncNow();
    };

    const handleOffline = () => {
      updateStatus();
      toast.info("Mode hors ligne activé");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void getOfflineQueueSize().then(setQueueSize);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && queueSize === 0) {
    return null;
  }

  return (
    <div className={cn("fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full border px-4 py-2 text-sm shadow-xl backdrop-blur", isOnline ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-amber-400/30 bg-amber-500/15 text-amber-50")}>
      <div className="flex items-center gap-3">
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <span>
          {isOnline ? `Synchronisation en attente: ${queueSize}` : "Mode hors ligne actif"}
        </span>
        {isOnline && queueSize > 0 && (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 rounded-full bg-white/10 text-inherit hover:bg-white/20"
            onClick={async () => {
              setSyncing(true);
              try {
                const results = await flushOfflineQueue();
                const successCount = results.filter((result) => result.ok).length;
                toast.success(`${successCount} action(s) synchronisée(s)`);
                setQueueSize(await getOfflineQueueSize());
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
            Synchroniser
          </Button>
        )}
      </div>
    </div>
  );
};

export default OfflineStatus;