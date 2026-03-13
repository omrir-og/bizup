"use client";

import { use, useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { getTransactions } from "@/lib/store";
import { groupByMonth, formatCurrency } from "@/lib/utils";
import AppShell from "@/components/AppShell";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import PartnerIntelligence from "@/components/PartnerIntelligence";
import CategoryBudgets from "@/components/CategoryBudgets";
import RecurringPanel from "@/components/RecurringPanel";
import { Lightbulb, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, Sparkles, RefreshCw, DollarSign, Activity, Star } from "lucide-react";

interface AIAnalysis {
  savings: string[];
  anomalies: string[];
  growth: string[];
  healthScore: number;
  healthReason: string;
}

const AI_CACHE_KEY = (bizId: string) => `bizup_ai_insights_${bizId}`;
const AI_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export default function InsightsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const { lang, setSelectedBusinessId, businesses } = useApp();
  const tr = t[lang];

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  useEffect(() => {
    setSelectedBusinessId(businessId);
    // Load cached AI analysis
    try {
      const raw = localStorage.getItem(AI_CACHE_KEY(businessId));
      if (raw) {
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < AI_CACHE_TTL) setAiAnalysis(data);
      }
    } catch { /* ignore */ }
  }, [businessId, setSelectedBusinessId]);

  const biz = businesses.find((b) => b.id === businessId);
  const transactions = getTransactions(businessId);
  const stats = groupByMonth(transactions);

  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Build context for AI
  const buildContext = () => {
    const monthlyBreakdown = stats.slice(-6).map((s) =>
      `${s.month}: income ₪${s.income.toFixed(0)}, expenses ₪${s.expenses.toFixed(0)}, profit ₪${s.netProfit.toFixed(0)}`
    ).join("\n");
    return `Business: ${biz?.name}, Industry: ${biz?.industry}
Total income: ₪${totalIncome.toFixed(0)}, Total expenses: ₪${totalExpenses.toFixed(0)}, Profit margin: ${profitMargin.toFixed(1)}%
Monthly data (last 6 months):\n${monthlyBreakdown}`;
  };

  const handleGenerateAI = async (forceRefresh = false) => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightsMode: true, context: buildContext(), lang }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
        localStorage.setItem(AI_CACHE_KEY(businessId), JSON.stringify({
          data: data.analysis,
          timestamp: Date.now(),
        }));
      }
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  // Rule-based insights
  const insights = [];
  if (stats.length >= 2) {
    const prev = stats[stats.length - 2];
    const curr = stats[stats.length - 1];
    if (curr && prev) {
      const profitChange = ((curr.netProfit - prev.netProfit) / Math.abs(prev.netProfit || 1)) * 100;
      insights.push({
        type: profitChange > 0 ? "success" : "warning",
        icon: profitChange > 0 ? TrendingUp : TrendingDown,
        title: lang === "he"
          ? `שינוי רווח חודשי: ${profitChange > 0 ? "+" : ""}${profitChange.toFixed(1)}%`
          : `Monthly profit change: ${profitChange > 0 ? "+" : ""}${profitChange.toFixed(1)}%`,
        desc: lang === "he"
          ? `הרווח עבר מ-${formatCurrency(prev.netProfit)} ל-${formatCurrency(curr.netProfit)}`
          : `Profit moved from ${formatCurrency(prev.netProfit)} to ${formatCurrency(curr.netProfit)}`,
        action: null,
      });

      const expChange = ((curr.expenses - prev.expenses) / (prev.expenses || 1)) * 100;
      if (expChange > 5) {
        insights.push({
          type: "warning",
          icon: AlertTriangle,
          title: lang === "he"
            ? `עלייה בהוצאות: +${expChange.toFixed(1)}%`
            : `Expense increase: +${expChange.toFixed(1)}%`,
          desc: lang === "he"
            ? `ההוצאות עלו מ-${formatCurrency(prev.expenses)} ל-${formatCurrency(curr.expenses)}`
            : `Expenses rose from ${formatCurrency(prev.expenses)} to ${formatCurrency(curr.expenses)}`,
          action: lang === "he" ? "בקש הצעות מספקים" : "Request supplier quotes",
        });
      }
    }
  }
  if (profitMargin > 20) {
    insights.push({
      type: "success",
      icon: CheckCircle,
      title: lang === "he" ? `מרווח רווח בריא: ${profitMargin.toFixed(1)}%` : `Healthy profit margin: ${profitMargin.toFixed(1)}%`,
      desc: lang === "he" ? "העסק פועל ביעילות גבוהה" : "The business is operating efficiently",
      action: lang === "he" ? "שקול השקעה חוזרת בצמיחה" : "Consider reinvesting in growth",
    });
  } else if (profitMargin < 10 && transactions.length > 0) {
    insights.push({
      type: "warning",
      icon: AlertTriangle,
      title: lang === "he" ? `מרווח רווח נמוך: ${profitMargin.toFixed(1)}%` : `Low profit margin: ${profitMargin.toFixed(1)}%`,
      desc: lang === "he" ? "ממוצע בריא הוא 15-25%" : "Healthy average is 15-25%",
      action: lang === "he" ? "בדוק הוצאות קבועות ומשתנות" : "Review fixed and variable costs",
    });
  }

  const healthColor = (score: number) => score >= 70 ? "text-green-600 bg-green-50" : score >= 40 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tr.insights}</h1>
          <p className="text-gray-500 mt-1">{biz?.name}</p>
        </div>

        {transactions.length === 0 ? (
          <p className="text-gray-400 text-center py-16">{tr.uploadFirst}</p>
        ) : (
          <>
            {/* Rule-based insights */}
            {insights.length > 0 && (
              <div className="space-y-4 mb-8">
                {insights.map((ins, i) => {
                  const Icon = ins.icon;
                  return (
                    <div key={i} className={`rounded-2xl p-6 border ${ins.type === "success" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                      <div className="flex items-start gap-4">
                        <Icon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${ins.type === "success" ? "text-green-600" : "text-amber-500"}`} />
                        <div className="flex-1">
                          <h3 className={`font-semibold mb-1 ${ins.type === "success" ? "text-green-800" : "text-amber-800"}`}>{ins.title}</h3>
                          <p className={`text-sm ${ins.type === "success" ? "text-green-600" : "text-amber-600"}`}>{ins.desc}</p>
                          {ins.action && (
                            <button className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50">
                              {ins.action} →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* AI Analysis section */}
            <div id="ai" className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-800">
                    {lang === "he" ? "ניתוח AI מעמיק" : "Deep AI Analysis"}
                  </h2>
                </div>
                <button
                  onClick={() => handleGenerateAI(true)}
                  disabled={aiLoading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {aiLoading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      {tr.aiAnalyzing}
                    </>
                  ) : aiAnalysis ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      {tr.refreshAnalysis}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {tr.generateAIAnalysis}
                    </>
                  )}
                </button>
              </div>

              {aiError && !aiAnalysis && !aiLoading && (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  <span>{tr.aiAnalysisFailed}</span>
                  <button
                    onClick={() => { setAiError(false); handleGenerateAI(true); }}
                    className="ms-4 text-sm font-medium text-red-600 hover:text-red-800 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                  >
                    {tr.retryAnalysis}
                  </button>
                </div>
              )}

              {aiAnalysis && (
                <div className="grid grid-cols-1 gap-4">
                  {/* Health score */}
                  <div className={`rounded-2xl p-5 border flex items-center gap-4 ${healthColor(aiAnalysis.healthScore)} border-current border-opacity-20`}>
                    <div className={`text-3xl font-bold flex-shrink-0 ${healthColor(aiAnalysis.healthScore).split(" ")[0]}`}>
                      {aiAnalysis.healthScore}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Star className="w-4 h-4" />
                        <span className="font-semibold">{tr.healthScore}</span>
                      </div>
                      <p className="text-sm">{aiAnalysis.healthReason}</p>
                    </div>
                  </div>

                  {/* Savings */}
                  {aiAnalysis.savings?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-5 h-5 text-red-500" />
                        <h3 className="font-semibold text-red-800">{tr.savingsOpportunities}</h3>
                      </div>
                      <ul className="space-y-2">
                        {aiAnalysis.savings.map((item, i) => (
                          <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                            <span className="text-red-400 flex-shrink-0">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Anomalies */}
                  {aiAnalysis.anomalies?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-5 h-5 text-amber-500" />
                        <h3 className="font-semibold text-amber-800">{tr.anomaliesDetected}</h3>
                      </div>
                      <ul className="space-y-2">
                        {aiAnalysis.anomalies.map((item, i) => (
                          <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                            <span className="text-amber-400 flex-shrink-0">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Growth */}
                  {aiAnalysis.growth?.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <h3 className="font-semibold text-green-800">{tr.growthRecommendations}</h3>
                      </div>
                      <ul className="space-y-2">
                        {aiAnalysis.growth.map((item, i) => (
                          <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                            <span className="text-green-400 flex-shrink-0">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Category breakdown */}
            {transactions.some((t) => t.category) && (
              <div className="mb-8">
                <CategoryBreakdown transactions={transactions} />
              </div>
            )}

            {/* Category budgets */}
            {transactions.some((t) => t.category) && (
              <div className="mb-8">
                <CategoryBudgets transactions={transactions} businessId={businessId} />
              </div>
            )}

            {/* Partner intelligence (clients + suppliers) */}
            <div id="suppliers" className="mb-8">
              <PartnerIntelligence transactions={transactions} businessId={businessId} />
            </div>

            {/* Recurring items + next month prediction */}
            <div className="mb-8">
              <RecurringPanel transactions={transactions} businessId={businessId} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
