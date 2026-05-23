import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const formatXAF = (v: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(v || 0);

type Caution = {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  status: "held" | "refunded" | "forfeited";
  reason: string;
  createdAt: string;
};

const statusConfig = {
  held: { label: "Retenue", className: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300" },
  refunded: { label: "Remboursée", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" },
  forfeited: { label: "Confisquée", className: "border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-300" },
};

const StaffCautions = () => {
  const [cautions, setCautions] = useState<Caution[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ studentId: "", amount: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchCautions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/finance/cautions");
      setCautions(data.cautions || []);
    } catch {
      setCautions([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCautions(); }, []);

  const filtered = cautions.filter((c) => filter === "all" || c.status === filter);

  const totals = {
    held: cautions.filter((c) => c.status === "held").reduce((s, c) => s + c.amount, 0),
    refunded: cautions.filter((c) => c.status === "refunded").reduce((s, c) => s + c.amount, 0),
    forfeited: cautions.filter((c) => c.status === "forfeited").reduce((s, c) => s + c.amount, 0),
  };

  const createCaution = async () => {
    if (!form.studentId || !form.amount || !form.reason) {
      toast.error("Tous les champs sont requis");
      return;
    }
    setSaving(true);
    try {
      await api.post("/finance/cautions", {
        studentId: form.studentId,
        amount: Number(form.amount),
        reason: form.reason,
      });
      toast.success("Caution enregistrée");
      setDialog(false);
      setForm({ studentId: "", amount: "", reason: "" });
      await fetchCautions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/finance/cautions/${id}`, { status });
      toast.success("Statut mis à jour");
      await fetchCautions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cautions</h1>
          <p className="text-muted-foreground mt-1">Gestion des cautions et dépôts de garantie</p>
        </div>
        <Button onClick={() => setDialog(true)}>
          <Plus className="h-4 w-4" />Nouvelle caution
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Retenues", value: formatXAF(totals.held), color: "text-amber-500" },
          { label: "Remboursées", value: formatXAF(totals.refunded), color: "text-emerald-500" },
          { label: "Confisquées", value: formatXAF(totals.forfeited), color: "text-red-500" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
              <p className={`mt-2 text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtre */}
      <div className="flex gap-2 flex-wrap">
        {["all", "held", "refunded", "forfeited"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}>
            {f === "all" ? "Toutes" : statusConfig[f as keyof typeof statusConfig]?.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-3 p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Aucune caution trouvée.</div>
          ) : (
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  {["Élève", "Montant", "Motif", "Statut", "Date", "Actions"].map((h) => (
                    <th key={h} className="p-4 text-left text-sm font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <td className="p-4 font-medium">{c.studentName}</td>
                    <td className="p-4 font-bold">{formatXAF(c.amount)}</td>
                    <td className="p-4 text-muted-foreground text-sm">{c.reason}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={statusConfig[c.status]?.className}>
                        {statusConfig[c.status]?.label}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground text-sm">
                      {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {c.status === "held" && (
                          <>
                            <Button size="sm" variant="outline"
                              onClick={() => updateStatus(c.id, "refunded")}>
                              Rembourser
                            </Button>
                            <Button size="sm" variant="destructive"
                              onClick={() => updateStatus(c.id, "forfeited")}>
                              Confisquer
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Dialog création */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle caution</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Input placeholder="ID de l'élève" value={form.studentId}
              onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} />
            <Input type="number" placeholder="Montant (FCFA)" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            <Input placeholder="Motif" value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annuler</Button>
            <Button disabled={saving} onClick={createCaution}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffCautions;
