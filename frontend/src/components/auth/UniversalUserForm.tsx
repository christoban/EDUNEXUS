import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";

import {
  type Class,
  type UserRole,
  type subject,
  type user,
} from "@/types";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/global/CustomInput";
import { api } from "@/lib/api";
import { CustomSelect } from "@/components/global/CustomSelect";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/AuthProvider";
import { CustomMultiSelect } from "@/components/global/CustomMultiSelect";
import { useNavigate } from "react-router";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

export type FormType = "login" | "create" | "update";
interface Props {
  type: FormType;
  initialData?: user | null;
  onSuccess?: () => void;
  role?: UserRole;
}

const createSchema = (type: FormType) => {
  return z
    .object({
      name:
        type === "login"
          ? z.string().optional()
          : z.string().min(2, "Name is required"),
      classId: z.string().optional(),
      subjectIds: z.array(z.string()).optional(),
      email: z.email("Invalid email address"),
      role: z.string().optional(),
      schoolSection: z.enum(["francophone", "anglophone", "bilingual"]).optional(),
      uiLanguagePreference: z.enum(["fr", "en"]).optional(),
      password:
        type === "update"
          ? z
              .string()
              .optional()
              .refine((val) => !val || val.length >= 6, {
                message: "Password must be at least 6 characters",
              })
          : z.string().min(6, "Password must be at least 6 characters"),
      confirmPassword:
        type === "create"
          ? z.string().min(8, {
              message: "Password must be at least 8 characters.",
            })
          : z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (type === "create" && data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          message: "Passwords don't match",
          path: ["confirmPassword"],
        });
      }
    });
};

type FormValues = z.infer<ReturnType<typeof createSchema>>;

const OPTION_FETCH_LIMIT = 100;

const loadAllPaginatedItems = async <T,>(
  endpoint: "classes" | "subjects",
  collectionKey: "classes" | "subjects"
): Promise<T[]> => {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data } = await api.get(
      `/${endpoint}?page=${page}&limit=${OPTION_FETCH_LIMIT}`
    );
    const pageItems = Array.isArray(data?.[collectionKey]) ? data[collectionKey] : [];
    items.push(...pageItems);
    totalPages = Number(data?.pagination?.pages || 1);
    page += 1;
  } while (page <= totalPages);

  return items;
};

const UniversalUserForm = ({ type, initialData, onSuccess, role }: Props) => {
  const language = useUILanguage();
  const isUpdate = type === "update";
  const isLogin = type === "login";
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [subjects, setSubjects] = useState<subject[]>([]);
  const [serverError, setServerError] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema(type)),
    defaultValues: {
      name: "",
      email: "",
      role: role,
      password: "",
      classId: undefined,
      subjectIds: [],
      schoolSection: undefined,
      uiLanguagePreference: undefined,
    },
  });

  // fetch classes
  useEffect(() => {
    if (isLogin) {
      setLoading(false);
      return;
    }

    const fetchClasses = async () => {
      try {
        setLoading(true);
        const allClasses = await loadAllPaginatedItems<Class>("classes", "classes");
        setClasses(allClasses);
      } catch (error) {
        if (!isLogin) {
          toast.error(t("users.form.loadClassesFail", language));
          console.log(error);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [isLogin, type]);

  // Fetch subjects
  useEffect(() => {
    if (isLogin) {
      setLoadingOptions(false);
      return;
    }

    const fetchSubjects = async () => {
      try {
        setLoadingOptions(true);
        const allSubjects = await loadAllPaginatedItems<subject>("subjects", "subjects");
        setSubjects(allSubjects);
        setLoadingOptions(false);
      } catch (error) {
        if (!isLogin) {
          toast.error(t("users.form.loadSubjectsFail", language));
          console.log(error);
        }
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchSubjects();
  }, [isLogin, type]);

  // Populate form for Update mode
  useEffect(() => {
    if (initialData && isUpdate) {
      const existingClassId =
        typeof initialData.studentClass === "object"
          ? initialData.studentClass?._id
          : initialData.studentClass;

      form.reset({
        name: initialData.name || "",
        email: initialData.email || "",
        role: initialData.role || "student",
        password: "",
        classId: existingClassId || "",
        subjectIds: initialData.teacherSubjects?.map((s) => s._id) || [],
        schoolSection: initialData.schoolSection,
        uiLanguagePreference: initialData.uiLanguagePreference,
      });
    }
  }, [isUpdate, initialData, form, classes]);

  async function onSubmit(data: FormValues) {
    try {
      setServerError("");
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        role: data.role,
      };

      if (data.classId) {
        payload.studentClass = data.classId;
      }

      if (Array.isArray(data.subjectIds)) {
        payload.teacherSubjects = data.subjectIds;
      }

      if (data.schoolSection) {
        payload.schoolSection = data.schoolSection;
      }

      if (data.uiLanguagePreference) {
        payload.uiLanguagePreference = data.uiLanguagePreference;
      }

      // For update, omit empty password to avoid backend validation rejection.
      if (data.password && data.password.trim().length > 0) {
        payload.password = data.password;
      }

      if (type === "create") {
        payload.password = data.password;
      }

      if (isLogin) {
        await api.post("/users/login", {
          email: data.email,
          password: data.password,
        });

        const { data: profile } = await api.get("/users/profile");
        setUser(profile.user);
        toast.success(t("users.form.loginSuccess", language));
        navigate("/dashboard", { replace: true });
      } else if (type === "create") {
        await api.post("/users/register", payload);
        toast.success(t("users.form.created", language));
        if (onSuccess) onSuccess();
      } else if (type === "update" && initialData?._id) {
        await api.put(`/users/update/${initialData._id}`, payload);
        toast.success(t("users.form.updated", language));
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.log(error);
      if (isLogin) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || t("users.form.loginInvalid", language);
        setServerError(message);
        return;
      }

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
        t("users.form.actionFail", language);

      toast.error(message);
    }
  }

  const classOptions = Array.isArray(classes)
    ? classes.map((c) => ({
        label: c.name,
        value: c._id,
      }))
    : [];
  const subjectOptions = Array.isArray(subjects)
    ? subjects.map((s) => ({ label: s.name, value: s._id }))
    : [];
  const roleOptions = role ? [{ label: role, value: role }] : [];
  const sectionOptions = [
    { label: t("users.form.section.francophone", language), value: "francophone" },
    { label: t("users.form.section.anglophone", language), value: "anglophone" },
    { label: t("users.form.section.bilingual", language), value: "bilingual" },
  ];
  const uiLanguageOptions = [
    { label: t("common.french", language), value: "fr" },
    { label: t("common.english", language), value: "en" },
  ];
  const selectedRole = (form.watch("role") as UserRole | undefined) || role;
  const selectedSection = form.watch("schoolSection");

  const pending = form.formState.isSubmitting;
  const showRoleSelector = !isLogin;
  // you can also include teacher is needed
  const showClassSelector = !isLogin && selectedRole === "student";
  const showSubjectSelector = !isLogin && selectedRole === "teacher";
  const showSectionSelector = !isLogin && (selectedRole === "student" || selectedRole === "teacher");
  const showUiLanguagePreference =
    !isLogin &&
    (selectedRole === "admin" ||
      (selectedRole === "teacher" && selectedSection === "bilingual"));

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4 w-full">
          {!isLogin && (
            <CustomInput
              control={form.control}
              name="name"
              label={t("users.form.fullName", language)}
              placeholder="Jane Doe"
              disabled={pending}
            />
          )}
          {/* role selector */}
          {showRoleSelector && (
            <CustomSelect
              control={form.control}
              name="role"
              label={t("users.form.role", language)}
              placeholder={t("users.form.selectRole", language)}
              options={roleOptions}
              disabled={pending}
            />
          )}
          <div className="col-span-2 space-y-2">
            {/* class */}
            {showClassSelector && (
              <CustomSelect
                control={form.control}
                name="classId"
                label={t("users.form.class", language)}
                placeholder={t("users.form.selectClass", language)}
                options={classOptions}
                disabled={pending}
                loading={loading}
              />
            )}
            {/* subjects(multiple select is need here) */}
            {showSubjectSelector && (
              <CustomMultiSelect
                control={form.control}
                name="subjectIds"
                label={t("users.form.subjects", language)}
                placeholder={t("users.form.selectSubjects", language)}
                options={subjectOptions}
                loading={loadingOptions}
                disabled={pending}
              />
            )}
            {showSectionSelector && (
              <CustomSelect
                control={form.control}
                name="schoolSection"
                label={t("users.form.schoolSection", language)}
                placeholder={t("users.form.selectSchoolSection", language)}
                options={sectionOptions}
                disabled={pending}
              />
            )}
            {showUiLanguagePreference && (
              <CustomSelect
                control={form.control}
                name="uiLanguagePreference"
                label={t("users.form.uiLanguagePreference", language)}
                placeholder={t("users.form.selectUiLanguagePreference", language)}
                options={uiLanguageOptions}
                disabled={pending}
              />
            )}
            <CustomInput
              control={form.control}
              name="email"
              label={t("users.form.email", language)}
              type="email"
              placeholder="m@example.com"
              disabled={pending}
            />
          </div>
          <div className="col-span-2">
            <CustomInput
              control={form.control}
              name="password"
              label={t("users.form.password", language)}
              type="password"
              placeholder={
                isUpdate ? t("users.form.newPasswordOptional", language) : t("users.form.password", language)
              }
              disabled={pending}
            />
          </div>
          {type === "create" && (
            <div className="col-span-2">
              <CustomInput
                control={form.control}
                name="confirmPassword"
                label={t("users.form.confirmPassword", language)}
                type="password"
                placeholder={t("users.form.confirmPassword", language)}
                disabled={pending}
              />
            </div>
          )}
          <div className="col-span-2 mt-2">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? t("common.processing", language)
                : type === "login"
                ? t("users.form.signIn", language)
                : type === "create"
                ? t("users.form.createAccount", language)
                : t("users.form.saveChanges", language)}
            </Button>
            {isLogin && serverError && (
              <p className="mt-2 text-sm text-destructive text-center">
                {serverError}
              </p>
            )}
          </div>
        </div>
      </FieldGroup>
    </form>
  );
};

export default UniversalUserForm;
