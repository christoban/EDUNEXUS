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

const today = new Date().toISOString().slice(0, 10);

export default function ExpensesPage() {
  const language = useUILanguage();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "utilities",
    description: "",
    amount: "",
    expenseDate: today,
    paymentMethod: "cash",
    transactionReference: "",
  });

  const categoryLabelByValue: Record<string, string> = {
    salary: t("finance.expenses.form.salary", language),
    utilities: t("finance.expenses.form.utilities", language),
    maintenance: t("finance.expenses.form.maintenance", language),
    supplies: t("finance.expenses.form.supplies", language),
    transport: t("finance.expenses.form.transport", language),
    other: t("finance.expenses.form.other", language),
  };

  const methodLabelByValue: Record<string, string> = {
    cash: t("finance.expenses.form.cash", language),
    bank_transfer: t("finance.expenses.form.transfer", language),
    mobile_money_mtn: t("finance.expenses.form.mtn", language),
    mobile_money_orange: t("finance.expenses.form.orange", language),
  };

  useEffect(() => {
    void fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/finance/expenses?limit=100");
      setExpenses(data?.expenses || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.expenses.loadFail", language));
    } finally {
      setLoading(false);
    }
  };

  const createExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post("/finance/expenses", {
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
        transactionReference:
          form.paymentMethod === "cash" ? undefined : form.transactionReference,
      });

      toast.success(t("finance.expenses.createSuccess", language));
      setForm((prev) => ({
        ...prev,
        description: "",
        amount: "",
        transactionReference: "",
      }));
      await fetchExpenses();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.expenses.createFail", language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("finance.expenses.title", language)}</h1>
        <p className="text-muted-foreground">{t("finance.expenses.subtitle", language)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.expenses.newExpense", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createExpense} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="salary">{t("finance.expenses.form.salary", language)}</option>
              <option value="utilities">{t("finance.expenses.form.utilities", language)}</option>
              <option value="maintenance">{t("finance.expenses.form.maintenance", language)}</option>
              <option value="supplies">{t("finance.expenses.form.supplies", language)}</option>
              <option value="transport">{t("finance.expenses.form.transport", language)}</option>
              <option value="other">{t("finance.expenses.form.other", language)}</option>
            </select>

            <Input
              placeholder={t("finance.expenses.form.description", language)}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              required
            />

            <Input
              type="number"
              min={1}
              placeholder={t("finance.expenses.form.amount", language)}
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />

            <Input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
              required
            />

            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={form.paymentMethod}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
            >
              <option value="cash">{t("finance.expenses.form.cash", language)}</option>
              <option value="bank_transfer">{t("finance.expenses.form.transfer", language)}</option>
              <option value="mobile_money_mtn">{t("finance.expenses.form.mtn", language)}</option>
              <option value="mobile_money_orange">{t("finance.expenses.form.orange", language)}</option>
            </select>

            <Input
              placeholder={t("finance.expenses.form.reference", language)}
              value={form.transactionReference}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, transactionReference: e.target.value }))
              }
              disabled={form.paymentMethod === "cash"}
              required={form.paymentMethod !== "cash"}
            />

            <div className="md:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving", language) : t("finance.expenses.form.save", language)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.expenses.history", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading", language)}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance.expenses.table.date", language)}</TableHead>
                  <TableHead>{t("finance.expenses.table.category", language)}</TableHead>
                  <TableHead>{t("finance.expenses.table.description", language)}</TableHead>
                  <TableHead>{t("finance.expenses.table.method", language)}</TableHead>
                  <TableHead>{t("finance.expenses.table.reference", language)}</TableHead>
                  <TableHead>{t("finance.expenses.table.amount", language)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense._id}>
                    <TableCell>
                      {new Date(expense.expenseDate).toLocaleDateString(
                        language === "fr" ? "fr-CM" : "en-GB"
                      )}
                    </TableCell>
                    <TableCell>{categoryLabelByValue[expense.category] || expense.category}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>{methodLabelByValue[expense.paymentMethod] || expense.paymentMethod}</TableCell>
                    <TableCell>{expense.transactionReference || "-"}</TableCell>
                    <TableCell>{formatXAF(Number(expense.amount))}</TableCell>
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
