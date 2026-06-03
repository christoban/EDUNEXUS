import { useEffect, useState } from "react";
import { Download, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const formatXAF = (v: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(v || 0);

type Invoice = {
  id: string;
  _id?: string;
  label: string;
  amount: number;
  status: "pending" | "partial" | "paid";
  dueDate: string;
  studentName?: string;
};

const statusConfig = {
  pending: { label: "En attente", className: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300" },
  partial: { label: "Partiel", className: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300" },
  paid: { label: "Payé", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" },
};

const ParentPayments = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [payDialog, setPayDialog] = useState<{ invoiceId: string; amount: number } | null>(null);
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [operator, setOperator] = useState<"MTN" | "ORANGE" | "UNKNOWN" | null>(null);

  const detectOp = (value: string) => {
    const normalized = value.replace(/\s+/g, "").replace(/^\+/, "");
    const digits = normalized.startsWith("237") ? normalized.slice(3) : normalized;
    const prefix = digits.slice(0, 3);
    const mtn = ["650","651","652","653","654","670","671","672","673","674","675","676","677","678","679","680","681","682","683","684","685","686","687","688","689"];
    const orange = ["655","656","657","658","659","690","691","692","693","694","695","696","697","698","699"];
    if (mtn.includes(prefix)) setOperator("MTN");
    else if (orange.includes(prefix)) setOperator("ORANGE");
    else setOperator(digits.length >= 3 ? "UNKNOWN" : null);
  };

  const loadInvoices = async () => {
    try {
      const { data } = await api.get("/finance/invoices");
      setInvoices(data.invoices || []);
    } catch { /* silently */ }
  };

  useEffect(() => {
    loadInvoices().finally(() => setLoading(false));
  }, []);

  const downloadReceipt = async (paymentId: string) => {
    setDownloading(paymentId);
    try {
      const response = await api.get(`/finance/payments/${paymentId}/receipt.pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `recu-${paymentId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* silently */ }
    finally { setDownloading(null); }
  };

  const initiatePay = async () => {
    if (!payDialog || !phone.trim()) {
      toast.error("Numéro de téléphone requis");
      return;
    }
    setPaying(true);
    try {
      const { data } = await api.post("/finance/payments/mobile/initiate", {
        invoiceId: payDialog.invoiceId,
        phoneNumber: phone,
      });
      setPaymentRef(data.reference);
      toast.success(`Paiement initié !${data.ussdCode ? ` Composez ${data.ussdCode}` : " Validez sur votre téléphone."}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors du paiement");
    } finally { setPaying(false); }
  };

  const checkStatus = async () => {
    if (!paymentRef) return;
    setCheckingStatus(true);
    try {
      const { data } = await api.get(`/finance/payments/mobile/${paymentRef}/status`);
      if (data.status === "SUCCESSFUL") {
        toast.success("Paiement confirmé !");
        setPayDialog(null);
        setPaymentRef(null);
        setPhone("");
        await loadInvoices();
      } else if (data.status === "FAILED") {
        toast.error("Paiement échoué. Réessayez.");
        setPaymentRef(null);
      } else {
        toast("Paiement en attente de confirmation...");
      }
    } catch { toast.error("Erreur de vérification"); }
    finally { setCheckingStatus(false); }
  };

  const closePayDialog = () => {
    setPayDialog(null);
    setPaymentRef(null);
    setPhone("");
    setOperator(null);
  };

  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const pending = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mes paiements</h1>
        <p className="text-muted-foreground mt-1">Suivi des frais scolaires et paiements</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total attendu", value: formatXAF(total), color: "text-foreground" },
          { label: "Payé", value: formatXAF(paid), color: "text-emerald-500" },
          { label: "Restant", value: formatXAF(pending), color: "text-red-500" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
              <p className={`mt-2 text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Liste factures */}
      {loading ? (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />Chargement...
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center text-muted-foreground">
          Aucune facture disponible.
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const id = invoice.id || invoice._id || "";
            const cfg = statusConfig[invoice.status] ?? statusConfig.pending;
            return (
              <Card key={id}>
                <CardContent className="flex items-center justify-between gap-3 p-5 flex-wrap">
                  <div className="space-y-1">
                    <p className="font-semibold">{invoice.label}</p>
                    {invoice.studentName && (
                      <p className="text-sm text-muted-foreground">{invoice.studentName}</p>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-lg font-bold">{formatXAF(invoice.amount)}</span>
                      <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Échéance : {new Date(invoice.dueDate).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {invoice.status !== "paid" && (
                      <Button
                        size="sm"
                        onClick={() => setPayDialog({ invoiceId: id, amount: invoice.amount })}
                      >
                        <Smartphone className="h-4 w-4" />Payer MTN MoMo
                      </Button>
                    )}
                    {invoice.status === "paid" && (
                      <Button size="sm" variant="outline" disabled={downloading === id}
                        onClick={() => downloadReceipt(id)}>
                        {downloading === id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><Download className="h-4 w-4" />Reçu</>
                        }
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog paiement mobile */}
      <Dialog open={!!payDialog} onOpenChange={closePayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payer par Mobile Money</DialogTitle>
          </DialogHeader>
          {!paymentRef ? (
            <div className="grid gap-4 py-2">
              <p className="text-sm text-muted-foreground">
                Montant : <strong>{formatXAF(payDialog?.amount ?? 0)}</strong>
              </p>
              <Input
                placeholder="Numéro MTN ou Orange (ex: 677XXXXXX ou 691XXXXXX)"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); detectOp(e.target.value); }}
              />
              <p className="text-xs text-muted-foreground">
                MTN MoMo : 67X, 68X · Orange Money : 69X, 655–659
              </p>
              {operator === "MTN" && (
                <div className="flex items-center gap-2 text-sm font-semibold text-yellow-600">
                  <span>📱</span> MTN MoMo détecté
                </div>
              )}
              {operator === "ORANGE" && (
                <div className="flex items-center gap-2 text-sm font-semibold text-orange-500">
                  <span>📱</span> Orange Money détecté
                </div>
              )}
              {operator === "UNKNOWN" && phone.length >= 9 && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <span>⚠️</span> Numéro non reconnu
                </div>
              )}
              <Button disabled={paying} onClick={initiatePay}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Payer maintenant"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 py-2 text-center">
              <p className="text-sm text-muted-foreground">
                Validez le paiement sur votre téléphone, puis vérifiez le statut.
              </p>
              <Button disabled={checkingStatus} onClick={checkStatus}>
                {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vérifier le paiement"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParentPayments;
