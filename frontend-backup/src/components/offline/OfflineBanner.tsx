import { useState } from "react";
import { WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { syncAll } from "@/lib/offlineQueue";

export const OfflineBanner = () => {
  const { isOnline, pendingCount, syncing, refreshPendingCount } = useOnlineStatus();
  const [manualSync, setManualSync] = useState(false);

  const handleManualSync = async () => {
    if (!isOnline || manualSync) return;
    setManualSync(true);
    try {
      const report = await syncAll();
      await refreshPendingCount();
      toast.success(`Synchronisation : ${report.accepted} accepté(s), ${report.rejected} rejeté(s)`);
    } catch {
      toast.error("Erreur de synchronisation");
    } finally {
      setManualSync(false);
    }
  };

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-2 text-sm font-medium ${
        isOnline ? "bg-amber-500 text-amber-950" : "bg-red-600 text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        {isOnline
          ? `${pendingCount} donnée(s) en attente de synchronisation`
          : `Mode hors ligne — ${pendingCount > 0 ? `${pendingCount} donnée(s) en attente` : "pas de connexion"}`}
      </div>
      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={manualSync || syncing}
          className="flex items-center gap-1 rounded-md bg-black/20 px-3 py-1 text-xs hover:bg-black/30 transition-colors"
        >
          {manualSync || syncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Synchroniser
        </button>
      )}
    </div>
  );
};