import Modal from "@/components/global/Modal";
import UniversalUserForm from "@/components/auth/UniversalUserForm";
import type { user, UserRole } from "@/types";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

const UserDialog = ({
  open,
  setOpen,
  editingUser,
  role,
  onSuccess,
}: {
  setOpen: (open: boolean) => void;
  open: boolean;
  editingUser: user | null;
  role: UserRole;
  onSuccess?: () => void;
}) => {
  const language = useUILanguage();
  const title = editingUser
    ? t("users.dialog.updateTitle", language)
    : t("users.dialog.createTitle", language);
  const description = editingUser
    ? t("users.dialog.updateDescription", language)
    : t("users.dialog.createDescription", language);
  const onSuccessPlus = () => {
    setOpen(false);
    onSuccess?.();
  };
  return (
    <Modal
      title={title}
      description={description}
      open={open}
      setOpen={setOpen}
    >
      <UniversalUserForm
        type={editingUser ? "update" : "create"}
        role={role}
        initialData={editingUser}
        onSuccess={onSuccessPlus}
      />
    </Modal>
  );
};

export default UserDialog;
