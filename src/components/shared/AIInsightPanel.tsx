"use client";

import { useState, useCallback } from "react";
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb, CheckCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";

interface Alert {
  type: "anomaly" | "recommendation" | "positive";
  text: string;
}

interface PageInsight {
  summary: string;
  alerts: Alert[];
}

interface AIInsightPanelProps {
  businessId: string;
  pageType: "categories" | "suppliers" | "clients" | "cashflow";
  contextData: string;
  timeRange?: string;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(businessId: string, pageType: string, timeRange?: string) {
  return `bizup_page_insight_${businessId}_${pageType}_${timeRange || "all"}`;
}

function getCachedInsight(key: string): PageInsight | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedInsight(key: string, data: PageInsight) {
  localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

export default function AIInsightPanel({ businessId, pageType, contextData, timeRange }: AIInsightPanelProps) {
  const { lang } = useApp();
  const tr = t[lang];
  const cacheKey = getCacheKey(businessId, pageType, timeRange);

  const [insight, setInsight] = useState<PageInsight | null>(() => getCachedInsight(cacheKey));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageInsightMode: true, pageType, context: contextData, lang }),
      });
      const json = await res.json();
      if (json.insight) {
        setInsight(json.insight);
        setCachedInsight(cacheKey, json.insight);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [pageType, contextData, lang, cacheKey]);

  const alertIcon = (type: string) => {
    if (type === "anomaly") return <AlertTriangle className="w-3.5 h-3.5" />;
    if (type === "recommendation") return <Lightbulb className="w-3.5 h-3.5" />;
    return <CheckCircle className="w-3.5 h-3.5" />;
  };

  const alertStyle = (type: string) => {
    if (type === "anomaly") return "bg-amber-50 border-amber-200 text-amber-800";
    if (type === "recommendation") return "bg-blue-50 border-blue-200 text-blue-800";
    return "bg-green-50 border-green-200 text-green-800";
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">BizUp AI</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white/70 hover:bg-white border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {insight
            ? (lang === "he" ? "רענן" : "Refresh")
            : (lang === "he" ? "צור תובנות" : "Generate Insights")}
        </button>
      </div>

      {loading && (
        <p className="text-sm text-blue-600 animate-pulse">
          {lang === "he" ? "BizUp AI מנתח את הנתונים..." : "BizUp AI is analyzing your data..."}
        </p>
      )}

      {error && !loading && (
        <p className="text-sm text-red-500">
          {lang === "he" ? "AI לא זמין כרגע" : "AI unavailable right now"}
        </p>
      )}

      {insight && !loading && (
        <>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{insight.summary}</p>
          {insight.alerts && insight.alerts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {insight.alerts.map((alert, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full ${alertStyle(alert.type)}`}
                >
                  {alertIcon(alert.type)}
                  {alert.text}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
