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

const defaultForm = {
  name: "",
  category: "tuition",
  frequency: "monthly",
  amount: "",
  academicYear: "",
  classId: "",
  dueDayOfMonth: "",
  notes: "",
};

export default function FeePlansPage() {
  const language = useUILanguage();
  const [feePlans, setFeePlans] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const categories = useMemo(
    () => [
      { value: "registration", label: t("finance.category.registration", language) },
      { value: "tuition", label: t("finance.category.tuition", language) },
      { value: "apee_pta", label: t("finance.category.apee_pta", language) },
      { value: "transport", label: t("finance.category.transport", language) },
      { value: "canteen", label: t("finance.category.canteen", language) },
      { value: "uniform_supplies", label: t("finance.category.uniform_supplies", language) },
      { value: "exam_fees", label: t("finance.category.exam_fees", language) },
      { value: "other", label: t("finance.category.other", language) },
    ],
    [language]
  );

  const categoryLabelByValue = useMemo(
    () => Object.fromEntries(categories.map((item) => [item.value, item.label])),
    [categories]
  );

  const frequencyLabelByValue: Record<string, string> = {
    one_time: t("finance.feePlans.form.oneTime", language),
    monthly: t("finance.feePlans.form.monthly", language),
    termly: t("finance.feePlans.form.termly", language),
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, classesRes, yearsRes] = await Promise.all([
        api.get("/finance/fee-plans?limit=100"),
        api.get("/classes?page=1&limit=100"),
        api.get("/academic-years?page=1&limit=100"),
      ]);

      setFeePlans(plansRes.data?.feePlans || []);
      setClasses(classesRes.data?.classes || []);
      setYears(yearsRes.data?.years || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.feePlans.loadDataFail", language));
    } finally {
      setLoading(false);
    }
  };

  const createFeePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.academicYear || !form.classId) {
      toast.error(t("finance.feePlans.validation.yearClassRequired", language));
      return;
    }

    try {
      setSaving(true);
      await api.post("/finance/fee-plans", {
        name: form.name,
        category: form.category,
        frequency: form.frequency,
        amount: Number(form.amount),
        academicYear: form.academicYear,
        classes: [form.classId],
        dueDayOfMonth: form.dueDayOfMonth ? Number(form.dueDayOfMonth) : undefined,
        notes: form.notes || undefined,
      });

      toast.success(t("finance.feePlans.createSuccess", language));
      setForm(defaultForm);
      await fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.feePlans.createFail", language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("finance.feePlans.title", language)}</h1>
        <p className="text-muted-foreground">{t("finance.feePlans.subtitle", language)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.feePlans.newPlan", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createFeePlan} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder={t("finance.feePlans.form.namePlaceholder", language)}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />

            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={form.frequency}
              onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
            >
              <option value="one_time">{t("finance.feePlans.form.oneTime", language)}</option>
              <option value="monthly">{t("finance.feePlans.form.monthly", language)}</option>
              <option value="termly">{t("finance.feePlans.form.termly", language)}</option>
            </select>

            <Input
              type="number"
              min={0}
              placeholder={t("finance.feePlans.form.amountPlaceholder", language)}
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />

            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={form.academicYear}
              onChange={(e) => setForm((prev) => ({ ...prev, academicYear: e.target.value }))}
              required
            >
              <option value="">{t("finance.feePlans.form.academicYear", language)}</option>
              {years.map((year) => (
                <option key={year._id} value={year._id}>
                  {year.name}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={form.classId}
              onChange={(e) => setForm((prev) => ({ ...prev, classId: e.target.value }))}
              required
            >
              <option value="">{t("finance.feePlans.form.class", language)}</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name}
                </option>
              ))}
            </select>

            <Input
              type="number"
              min={1}
              max={31}
              placeholder={t("finance.feePlans.form.dueDayPlaceholder", language)}
              value={form.dueDayOfMonth}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDayOfMonth: e.target.value }))}
            />

            <Input
              placeholder={t("finance.feePlans.form.notesPlaceholder", language)}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />

            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving", language) : t("finance.feePlans.form.create", language)}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.feePlans.existingPlans", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading", language)}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance.feePlans.table.name", language)}</TableHead>
                  <TableHead>{t("finance.feePlans.table.category", language)}</TableHead>
                  <TableHead>{t("finance.feePlans.table.frequency", language)}</TableHead>
                  <TableHead>{t("finance.feePlans.table.amount", language)}</TableHead>
                  <TableHead>{t("finance.feePlans.table.year", language)}</TableHead>
                  <TableHead>{t("finance.feePlans.table.classes", language)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feePlans.map((plan) => (
                  <TableRow key={plan._id}>
                    <TableCell>{plan.name}</TableCell>
                    <TableCell>{categoryLabelByValue[plan.category] || plan.category}</TableCell>
                    <TableCell>{frequencyLabelByValue[plan.frequency] || plan.frequency}</TableCell>
                    <TableCell>{formatXAF(Number(plan.amount))}</TableCell>
                    <TableCell>{plan.academicYear?.name || t("common.na", language)}</TableCell>
                    <TableCell>
                      {Array.isArray(plan.classes)
                        ? plan.classes
                            .map((item: any) => item?.name || t("common.na", language))
                            .join(", ")
                        : t("common.na", language)}
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
