import { AlertTriangle, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOfflineCacheSummary } from "@/lib/offlineSync";
import { useEffect, useState } from "react";
import { SyncReportView } from "@/components/offline/SyncReport";

const OfflinePage = () => {
  const [summary, setSummary] = useState({ classes: 0, students: 0, timetable: 0 });

  useEffect(() => {
    void getOfflineCacheSummary().then(setSummary);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <Card className="w-full border-white/10 bg-slate-950/80 text-white shadow-2xl backdrop-blur">
          <CardContent className="grid gap-8 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
                <WifiOff className="h-4 w-4" />
                Mode hors ligne
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight md:text-6xl">EduNexus reste accessible sans réseau.</h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  Les écrans consultés récemment et les actions critiques mises en file d’attente restent disponibles localement. Dès que la connexion revient, la synchronisation repart automatiquement.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="rounded-full bg-sky-400 text-slate-950 hover:bg-sky-300" onClick={() => window.location.reload()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Réessayer la connexion
                </Button>
                <Button variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => window.location.assign("/") }>
                  Retour à l’accueil
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Classes mises en cache" value={summary.classes} />
                <Stat label="Élèves mis en cache" value={summary.students} />
                <Stat label="Emplois du temps" value={summary.timetable} />
              </div>
            </div>

            <div className="grid gap-4">
              <Card className="border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-3 text-emerald-200">
                    <ShieldCheck className="h-5 w-5" />
                    <h2 className="font-semibold">Ce qui fonctionne hors ligne</h2>
                  </div>
                  <ul className="space-y-3 text-sm text-slate-300">
                    <li className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />Consultation des données déjà ouvertes.</li>
                    <li className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />Saisie des présences et notes mise en file d’attente.</li>
                    <li className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />Synchronisation automatique au retour du réseau.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 w-full border-white/10 bg-slate-950/70 text-white shadow-xl backdrop-blur">
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Rapports de synchronisation</h2>
            <SyncReportView />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <div className="text-2xl font-black">{value}</div>
    <div className="mt-1 text-sm text-slate-400">{label}</div>
  </div>
);

export default OfflinePage;