import { useEffect, useState } from "react";
import { syncAll, getPendingCount } from "@/lib/offlineQueue";
import { toast } from "sonner";

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

  useEffect(() => {
    void refreshPendingCount();

    const handleOnline = async () => {
      setIsOnline(true);
      const count = await getPendingCount();
      if (count > 0) {
        toast.info(`Connexion rétablie — synchronisation de ${count} élément(s)...`);
        setSyncing(true);
        try {
          const report = await syncAll();
          setPendingCount(0);
          if (report.accepted > 0) {
            toast.success(`✅ ${report.accepted} élément(s) synchronisé(s)`);
          }
          if (report.rejected > 0) {
            toast.error(`⚠️ ${report.rejected} élément(s) rejeté(s) — voir le rapport`);
          }
        } catch {
          toast.error("Erreur de synchronisation");
        } finally {
          setSyncing(false);
        }
      } else {
        setIsOnline(true);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Mode hors ligne — les données seront synchronisées au retour");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, pendingCount, syncing, refreshPendingCount };
};