import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/AuthProvider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";

export function ParentSettings() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [language, setLanguage] = useState<"fr" | "en">(
    user?.parentLanguagePreference || "fr"
  );
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.parentLanguagePreference) {
      setLanguage(user.parentLanguagePreference);
    }
  }, [user?.parentLanguagePreference]);

  const handleSaveLanguage = async () => {
    try {
      setLoading(true);
      setSaved(false);

      const response = await api.patch(`/users/${user?._id}`, {
        parentLanguagePreference: language,
      });

      // Update user context
      setUser(response.data.user);

      // Dispatch event for real-time UI refresh
      window.dispatchEvent(
        new CustomEvent("parent-language-changed", {
          detail: { language },
        })
      );

      setSaved(true);
      toast({
        title: language === "fr" ? "Succes" : "Success",
        description: t("success.languageUpdated", language),
      });

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: t("error.languageUpdate", language),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Only render for parent role
  if (user?.role !== "parent") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">
          {t("parent.settings", language)}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("parent.languagePreference", language)}:
            </label>
            <div className="flex gap-3">
              <Select value={language} onValueChange={(value: any) => setLanguage(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">
                    Français
                  </SelectItem>
                  <SelectItem value="en">
                    English
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleSaveLanguage}
                disabled={loading}
                className={saved ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {loading
                  ? t("parent.settings.saving", language)
                  : saved
                    ? `✓ ${t("parent.settings.saved", language)}`
                    : t("parent.settings.save", language)}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {t("parent.settings.scope", language)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          {t("parent.settings.tip", language)}
        </p>
      </div>
    </div>
  );
}
