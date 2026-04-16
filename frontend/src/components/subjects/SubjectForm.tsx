import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { subjectFormSchema, type SubjectFormValues } from "./schema";

// UI Imports
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomInput } from "@/components/global/CustomInput";
import { CustomMultiSelect } from "@/components/global/CustomMultiSelect";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { subject } from "@/types";
import Modal from "@/components/global/Modal";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

interface Option {
  _id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: subject | null;
  onSuccess: () => void;
}

export function SubjectForm({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: Props) {
  const language = useUILanguage();
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // 1. Fetch Teachers for the dropdown
  useEffect(() => {
    if (open) {
      const fetchTeachers = async () => {
        setLoadingOptions(true);
        try {
          const { data } = await api.get("/users?role=teacher");
          setTeachers(data.users);
        } catch (error) {
          toast.error(t("subjects.form.loadTeachersFail", language));
        } finally {
          setLoadingOptions(false);
        }
      };
      fetchTeachers();
    }
  }, [open]);

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema) as Resolver<SubjectFormValues>,
    defaultValues: {
      name: "",
      code: "",
      teacher: [],
      isActive: true,
    },
  });

  // 2. Populate or Reset Form
  useEffect(() => {
    if (initialData) {
      // FIX: Map the array of teacher objects to an array of IDs (strings)
      const teacherIds = initialData.teacher
        ? initialData.teacher.map((t: any) =>
            typeof t === "object" ? t._id : t
          )
        : [];

      form.reset({
        name: initialData.name || "",
        code: initialData.code || "",
        teacher: teacherIds, // <--- Send IDs only, not objects
        isActive: initialData.isActive ?? true,
      });
    } else {
      form.reset({
        name: "",
        code: "",
        teacher: [],
        isActive: true,
      });
    }
  }, [initialData, form, open]);

  const onSubmit = async (values: SubjectFormValues) => {
    // console.log("Submitting:", values);
    try {
      // Logic: Convert empty array -> null for the backend
      const payload = {
        ...values,
        teacher:
          !values.teacher || values.teacher.length === 0
            ? null
            : values.teacher,
      };

      if (initialData) {
        await api.patch(`/subjects/update/${initialData._id}`, payload);
        toast.success(t("subjects.form.updated", language));
      } else {
        await api.post("/subjects/create", payload);
        toast.success(t("subjects.form.created", language));
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      const responseData = error?.response?.data;
      const validationErrors = Array.isArray(responseData?.errors)
        ? responseData.errors
            .map((entry: any) => entry?.message)
            .filter(Boolean)
            .join(" | ")
        : "";

      const message =
        validationErrors ||
        responseData?.message ||
        error?.message ||
        t("subjects.form.operationFail", language);

      toast.error(message);
    }
  };

  const pending = form.formState.isSubmitting;
  const teachersOptions = teachers.map((teacher) => ({
    label: teacher.name,
    value: teacher._id,
  }));

  return (
    <Modal
      title={
        initialData ? t("subjects.form.editTitle", language) : t("subjects.form.createTitle", language)
      }
      description={
        initialData
          ? t("subjects.form.editDescription", language)
          : t("subjects.form.createDescription", language)
      }
      open={open}
      setOpen={onOpenChange}
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <CustomInput
              control={form.control}
              name="name"
              label={t("subjects.form.name", language)}
              placeholder="Mathematics"
              disabled={pending}
            />
            <CustomInput
              control={form.control}
              name="code"
              label={t("subjects.form.code", language)}
              placeholder="MATH-101"
              disabled={pending}
            />
          </div>
          <CustomMultiSelect
            control={form.control}
            name="teacher"
            label={t("subjects.form.teacher", language)}
            placeholder={t("subjects.form.selectTeacher", language)}
            options={teachersOptions}
            loading={loadingOptions}
            disabled={pending}
          />
          <Controller
            name="isActive"
            control={form.control}
            render={({ field: { value, onChange, ...field }, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex flex-row space-x-3 rounded-md border p-3">
                  <Checkbox
                    id="isActive"
                    checked={value}
                    onCheckedChange={onChange}
                    {...field}
                  />
                  <div className="space-y-1">
                    <FieldLabel
                      htmlFor="isActive"
                      className="cursor-pointer mb-0"
                    >
                      {t("subjects.form.activeTitle", language)}
                    </FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      {t("subjects.form.activeHint", language)}
                    </p>
                  </div>
                </div>
              </Field>
            )}
          />
        </FieldGroup>
        <Button
          type="submit"
          className="w-full mt-4"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? t("common.saving", language) : t("subjects.form.save", language)}
        </Button>
      </form>
    </Modal>
  );
}
