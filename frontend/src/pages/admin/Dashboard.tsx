import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Loader2, TrendingUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardData = {
  totalStudents?: number;
  totalTeachers?: number;
  totalClasses?: number;
  pendingGrades?: number;
  recentActivities?: { id: string; action: string; createdAt: string }[];
};

const AdminDashboard = () => {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [usersRes, classesRes] = await Promise.allSettled([
          api.get("/users?limit=1&role=STUDENT"),
          api.get("/classes?limit=1"),
        ]);

        setData({
          totalStudents: usersRes.status === "fulfilled" ? usersRes.value.data?.pagination?.total ?? 0 : 0,
          totalClasses: classesRes.status === "fulfilled" ? classesRes.value.data?.pagination?.total ?? 0 : 0,
        });
      } catch { /* silently */ } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const kpis = [
    { label: "Élèves", value: data.totalStudents ?? 0, icon: <Users className="h-5 w-5" />, color: "text-sky-300" },
    { label: "Classes", value: data.totalClasses ?? 0, icon: <BookOpen className="h-5 w-5" />, color: "text-emerald-300" },
    { label: "Notes en attente", value: data.pendingGrades ?? 0, icon: <AlertTriangle className="h-5 w-5" />, color: "text-amber-300" },
    { label: "Enseignants", value: data.totalTeachers ?? 0, icon: <TrendingUp className="h-5 w-5" />, color: "text-violet-300" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-slate-400">Vue d'ensemble de l'établissement</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="border-white/10 bg-slate-900/90 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">{kpi.label}</p>
                      <p className={`mt-2 text-4xl font-black ${kpi.color}`}>{kpi.value}</p>
                    </div>
                    <div className={kpi.color}>{kpi.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-white/10 bg-slate-900/90 text-white">
            <CardHeader><CardTitle className="text-base">Actions rapides</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {[
                { label: "Gérer les utilisateurs", href: "/admin/users" },
                { label: "Gérer les classes", href: "/admin/classes" },
                { label: "Gérer les matières", href: "/admin/subjects" },
                { label: "Statut des notes", href: "/admin/grades" },
                { label: "Bulletins scolaires", href: "/admin/report-cards" },
                { label: "Paramètres de l'école", href: "/admin/settings" },
              ].map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  {action.label}
                  <span className="text-slate-500">→</span>
                </a>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/90 text-white">
            <CardHeader><CardTitle className="text-base">Alertes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                <p className="font-semibold">Notes en attente de validation</p>
                <p className="text-xs text-amber-50/70 mt-1">Vérifiez le tableau de bord des notes</p>
              </div>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                <p className="font-semibold">Système opérationnel</p>
                <p className="text-xs text-emerald-50/70 mt-1">Tous les modules fonctionnent normalement</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
