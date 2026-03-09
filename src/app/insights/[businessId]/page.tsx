"use client";

import { use, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { getTransactions } from "@/lib/store";
import { groupByMonth, formatCurrency } from "@/lib/utils";
import AppShell from "@/components/AppShell";
import { Lightbulb, TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

export default function InsightsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const { lang, setSelectedBusinessId, businesses } = useApp();
  const tr = t[lang];

  useEffect(() => {
    setSelectedBusinessId(businessId);
  }, [businessId, setSelectedBusinessId]);

  const biz = businesses.find((b) => b.id === businessId);
  const transactions = getTransactions(businessId);
  const stats = groupByMonth(transactions);

  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Generate insights
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

  // Category breakdown
  const categories: Record<string, number> = {};
  transactions.filter((t) => t.amount < 0).forEach((t) => {
    const key = t.description.split(" ")[0];
    categories[key] = (categories[key] || 0) + Math.abs(t.amount);
  });
  const topExpenses = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tr.insights}</h1>
          <p className="text-gray-500 mt-1">{biz?.name}</p>
        </div>

        {insights.length === 0 && transactions.length === 0 ? (
          <p className="text-gray-400 text-center py-16">{tr.uploadFirst}</p>
        ) : (
          <div className="space-y-4 mb-8">
            {insights.map((ins, i) => {
              const Icon = ins.icon;
              return (
                <div
                  key={i}
                  className={`rounded-2xl p-6 border ${
                    ins.type === "success"
                      ? "bg-green-50 border-green-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Icon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${ins.type === "success" ? "text-green-600" : "text-amber-500"}`} />
                    <div className="flex-1">
                      <h3 className={`font-semibold mb-1 ${ins.type === "success" ? "text-green-800" : "text-amber-800"}`}>
                        {ins.title}
                      </h3>
                      <p className={`text-sm ${ins.type === "success" ? "text-green-600" : "text-amber-600"}`}>
                        {ins.desc}
                      </p>
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

        {/* Top expenses */}
        {topExpenses.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-gray-800">
                {lang === "he" ? "הוצאות עיקריות" : "Top Expenses"}
              </h3>
            </div>
            <div className="space-y-3">
              {topExpenses.map(([name, amount]) => (
                <div key={name} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-700">{name}</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full"
                        style={{ width: `${(amount / (topExpenses[0][1] || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
