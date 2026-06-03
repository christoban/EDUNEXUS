import { useState } from "react";
import { Sparkles, RefreshCw, Lightbulb, BrainCircuit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  role?: string;
}

export function AiInsightWidget({ role }: Props) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async () => {
    setLoading(true);
    setError(null);
    setInsight(null);
    
    try {
      console.log("🤖 Calling AI insight API...");
      const { data } = await api.post("/ai/generate-insight");
      console.log("✅ API Response:", data);
      setInsight(data.insight);
      setError(null);
    } catch (error: any) {
      console.error("❌ AI Insight Error Details:");
      console.error("Status:", error?.response?.status);
      console.error("Data:", error?.response?.data);
      console.error("Message:", error?.message);
      console.error("Full Error:", error);
      
      const errorMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Unknown error occurred";
      
      setError(errorMsg);
      setInsight(null);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-linear-to-br from-green-50 to-white border dark:from-green-800 shadow-sm overflow-hidden relative">
      {/* Decorative Background Icon */}
      <BrainCircuit className="absolute -right-6 -bottom-6 h-32 w-32 text-violet-100/50" />

      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> AI Academic Advisor
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-violet-600 hover:text-violet-800 hover:bg-violet-100"
          onClick={generateInsight}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 space-y-2">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">❌ Error Details:</p>
              <p className="text-xs text-red-600 dark:text-red-300 font-mono bg-red-100 dark:bg-red-900/40 p-2 rounded break-words">
                {error}
              </p>
            </div>
            <div className="text-center">
              <Button size="sm" onClick={generateInsight} variant="outline">
                Try Again
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Check browser console (F12) for more details
              </p>
            </div>
          </div>
        ) : insight ? (
          <div className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              {insight}
            </p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm mb-3">
              Tap to analyze attendance, grades, and schedules.
            </p>
            <Button size="sm" onClick={generateInsight}>
              Generate Insight
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// just an example of how to use the AiInsightWidget in a dashboard page
