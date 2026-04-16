import { useEffect, useMemo, useState } from "react";
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

const today = new Date().toISOString().slice(0, 10);

export default function PaymentsPage() {
  const language = useUILanguage();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    invoiceId: "",
    amount: "",
    paymentDate: today,
    method: "cash",
    transactionReference: "",
    notes: "",
  });

  useEffect(() => {
    void fetchData();
  }, []);

  const selectedInvoice = useMemo(
    () => invoices.find((item) => item._id === form.invoiceId),
    [invoices, form.invoiceId]
  );

  const methodLabelByValue: Record<string, string> = {
    cash: t("finance.payments.form.cashDesk", language),
    bank_transfer: t("finance.payments.form.bankTransfer", language),
    mobile_money_mtn: t("finance.payments.form.mtn", language),
    mobile_money_orange: t("finance.payments.form.orange", language),
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invRes, payRes] = await Promise.all([
        api.get("/finance/invoices?status=issued&limit=100"),
        api.get("/finance/payments?limit=100"),
      ]);

      const issued = invRes.data?.invoices || [];
      setInvoices(issued.filter((inv: any) => Number(inv.balance) > 0));
      setPayments(payRes.data?.payments || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.payments.loadDataFail", language));
    } finally {
      setLoading(false);
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      await api.post("/finance/payments", {
        invoiceId: form.invoiceId,
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        method: form.method,
        transactionReference:
          form.method === "cash" ? undefined : form.transactionReference,
        notes: form.notes || undefined,
      });

      toast.success(t("finance.payments.recordSuccess", language));
      setForm((prev) => ({
        ...prev,
        amount: "",
        transactionReference: "",
        notes: "",
      }));
      await fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.payments.recordFail", language));
    } finally {
      setSaving(false);
    }
  };

  const downloadReceipt = async (paymentId: string, receiptNumber: string) => {
    try {
      const response = await api.get(`/finance/payments/${paymentId}/receipt.pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${receiptNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.payments.downloadFail", language));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("finance.payments.title", language)}</h1>
        <p className="text-muted-foreground">{t("finance.payments.subtitle", language)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.payments.newPayment", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPayment} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={form.invoiceId}
              onChange={(e) => setForm((prev) => ({ ...prev, invoiceId: e.target.value }))}
              required
            >
              <option value="">{t("finance.payments.form.invoice", language)}</option>
              {invoices.map((invoice) => (
                <option key={invoice._id} value={invoice._id}>
                  {invoice.invoiceNumber} - {invoice.student?.name || t("common.na", language)} ({formatXAF(Number(invoice.balance))})
                </option>
              ))}
            </select>

            <Input
              type="number"
              min={1}
              placeholder={t("finance.payments.form.amount", language)}
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />

            <Input
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
              required
            />

            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={form.method}
              onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value }))}
            >
              <option value="cash">{t("finance.payments.form.cashDesk", language)}</option>
              <option value="bank_transfer">{t("finance.payments.form.bankTransfer", language)}</option>
              <option value="mobile_money_mtn">{t("finance.payments.form.mtn", language)}</option>
              <option value="mobile_money_orange">{t("finance.payments.form.orange", language)}</option>
            </select>

            <Input
              placeholder={t("finance.payments.form.transactionRef", language)}
              value={form.transactionReference}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, transactionReference: e.target.value }))
              }
              disabled={form.method === "cash"}
              required={form.method !== "cash"}
            />

            <Input
              placeholder={t("finance.payments.form.notes", language)}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />

            <div className="md:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving", language) : t("finance.payments.form.submit", language)}
              </Button>
              {selectedInvoice ? (
                <span className="ml-3 text-sm text-muted-foreground">
                  {t("finance.payments.form.invoiceBalance", language)} {formatXAF(Number(selectedInvoice.balance))}
                </span>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.payments.history", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading", language)}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance.payments.table.receipt", language)}</TableHead>
                  <TableHead>{t("finance.payments.table.invoice", language)}</TableHead>
                  <TableHead>{t("finance.payments.table.student", language)}</TableHead>
                  <TableHead>{t("finance.payments.table.method", language)}</TableHead>
                  <TableHead>{t("finance.payments.table.amount", language)}</TableHead>
                  <TableHead>{t("finance.payments.table.date", language)}</TableHead>
                  <TableHead>{t("finance.payments.table.reference", language)}</TableHead>
                  <TableHead>{t("finance.payments.table.pdf", language)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell>{payment.receiptNumber}</TableCell>
                    <TableCell>{payment.invoice?.invoiceNumber || t("common.na", language)}</TableCell>
                    <TableCell>{payment.student?.name || t("common.na", language)}</TableCell>
                    <TableCell>{methodLabelByValue[payment.method] || payment.method}</TableCell>
                    <TableCell>{formatXAF(Number(payment.amount))}</TableCell>
                    <TableCell>
                      {new Date(payment.paymentDate).toLocaleDateString(
                        language === "fr" ? "fr-CM" : "en-GB"
                      )}
                    </TableCell>
                    <TableCell>{payment.transactionReference || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadReceipt(payment._id, payment.receiptNumber)}
                      >
                        {t("finance.payments.receiptPdf", language)}
                      </Button>
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
