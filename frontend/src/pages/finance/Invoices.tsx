import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

const formatXAF = (value: number) =>
  new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(value || 0);

const defaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
};

export default function InvoicesPage() {
  const language = useUILanguage();
  const [feePlans, setFeePlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feePlanId, setFeePlanId] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate());

  const statusLabelByValue: Record<string, string> = {
    issued: t("finance.invoices.status.issued", language),
    partially_paid: t("finance.invoices.status.partially_paid", language),
    paid: t("finance.invoices.status.paid", language),
    overdue: t("finance.invoices.status.overdue", language),
    cancelled: t("finance.invoices.status.cancelled", language),
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, invoicesRes] = await Promise.all([
        api.get("/finance/fee-plans?limit=100"),
        api.get("/finance/invoices?limit=100"),
      ]);

      setFeePlans(plansRes.data?.feePlans || []);
      setInvoices(invoicesRes.data?.invoices || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.invoices.loadDataFail", language));
    } finally {
      setLoading(false);
    }
  };

  const generateInvoices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feePlanId) {
      toast.error(t("finance.invoices.validation.selectPlan", language));
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post("/finance/invoices/from-fee-plan", {
        feePlanId,
        dueDate,
      });

      toast.success(t("finance.invoices.generateSuccess", language, { count: String(data?.count || 0) }));
      await fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.invoices.generateFail", language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("finance.invoices.title", language)}</h1>
        <p className="text-muted-foreground">{t("finance.invoices.subtitle", language)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.invoices.generateTitle", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={generateInvoices} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={feePlanId}
              onChange={(e) => setFeePlanId(e.target.value)}
              required
            >
              <option value="">{t("finance.invoices.form.selectPlan", language)}</option>
              {feePlans.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {plan.name} - {formatXAF(Number(plan.amount))}
                </option>
              ))}
            </select>

            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />

            <Button type="submit" disabled={saving}>
              {saving ? t("reportCards.generating", language) : t("finance.invoices.form.generate", language)}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.invoices.listTitle", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading", language)}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance.invoices.table.invoiceNumber", language)}</TableHead>
                  <TableHead>{t("finance.invoices.table.student", language)}</TableHead>
                  <TableHead>{t("finance.invoices.table.class", language)}</TableHead>
                  <TableHead>{t("finance.invoices.table.total", language)}</TableHead>
                  <TableHead>{t("finance.invoices.table.paid", language)}</TableHead>
                  <TableHead>{t("finance.invoices.table.balance", language)}</TableHead>
                  <TableHead>{t("finance.invoices.table.status", language)}</TableHead>
                  <TableHead>{t("finance.invoices.table.dueDate", language)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice._id}>
                    <TableCell>{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.student?.name || t("common.na", language)}</TableCell>
                    <TableCell>{invoice.class?.name || t("common.na", language)}</TableCell>
                    <TableCell>{formatXAF(Number(invoice.totalAmount))}</TableCell>
                    <TableCell>{formatXAF(Number(invoice.amountPaid))}</TableCell>
                    <TableCell>{formatXAF(Number(invoice.balance))}</TableCell>
                    <TableCell>{statusLabelByValue[invoice.status] || invoice.status}</TableCell>
                    <TableCell>
                      {new Date(invoice.dueDate).toLocaleDateString(
                        language === "fr" ? "fr-CM" : "en-GB"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
