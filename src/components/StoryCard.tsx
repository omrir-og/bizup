"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { groupByMonth, formatCurrency } from "@/lib/utils";
import { Transaction } from "@/types";
import { TrendingUp, TrendingDown, Users, BarChart2, Sparkles } from "lucide-react";

interface Props {
  transactions: Transaction[];
  businessId: string;
}

export default function StoryCard({ transactions, businessId }: Props) {
  const { lang } = useApp();
  const tr = t[lang];
  const router = useRouter();

  const stats = groupByMonth(transactions);
  const lastMonth = stats[stats.length - 1];
  const prevMonth = stats[stats.length - 2];

  if (!lastMonth) return null;

  const profit = lastMonth.netProfit;
  const profitChange = prevMonth && prevMonth.netProfit !== 0
    ? ((profit - prevMonth.netProfit) / Math.abs(prevMonth.netProfit)) * 100
    : null;
  const margin = lastMonth.income > 0 ? (profit / lastMonth.income) * 100 : 0;

  // Determine health
  let health: "healthy" | "watch" | "alert";
  if (profit > 0 && margin >= 15) health = "healthy";
  else if (profit > 0 || margin >= 5) health = "watch";
  else health = "alert";

  const healthColors = {
    healthy: { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500", text: "text-green-700", label: tr.storyHealthy },
    watch: { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400", text: "text-amber-700", label: tr.storyWatch },
    alert: { bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", text: "text-red-700", label: tr.storyNeedsAttention },
  };
  const c = healthColors[health];

  // Build narrative
  const monthName = new Date(lastMonth.month + "-01").toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { month: "long" });
  const madeOrLost = profit >= 0
    ? (lang === "he" ? `הרווחת ${formatCurrency(profit)}` : `you made ${formatCurrency(profit)}`)
    : (lang === "he" ? `הפסדת ${formatCurrency(Math.abs(profit))}` : `you lost ${formatCurrency(Math.abs(profit))}`);

  const changeText = profitChange !== null
    ? ` — ${profitChange > 0 ? "▲" : "▼"} ${Math.abs(profitChange).toFixed(0)}% ${lang === "he" ? "לעומת חודש קודם" : "vs last month"}`
    : "";

  const narrative = lang === "he"
    ? `ב${monthName}, ${madeOrLost}${changeText}.`
    : `In ${monthName}, ${madeOrLost}${changeText}.`;

  const actions = [
    { label: tr.seeSuppliers, icon: Users, href: `/insights/${businessId}#suppliers` },
    { label: tr.checkForecast, icon: BarChart2, href: `/dashboard/${businessId}#forecast` },
    { label: tr.improveWithAI, icon: Sparkles, href: `/insights/${businessId}#ai` },
  ];

  return (
    <div className={`rounded-2xl p-6 border ${c.bg} ${c.border} mb-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Health badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot}`} />
            <span className={`text-sm font-semibold ${c.text}`}>{c.label}</span>
          </div>

          {/* Narrative */}
          <p className="text-gray-800 text-lg font-medium leading-snug mb-4">{narrative}</p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-4 mb-5">
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">{lang === "he" ? "הכנסות" : "Income"}:</span>
              <span className="font-semibold text-gray-800">{formatCurrency(lastMonth.income)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-gray-600">{lang === "he" ? "הוצאות" : "Expenses"}:</span>
              <span className="font-semibold text-gray-800">{formatCurrency(lastMonth.expenses)}</span>
            </div>
          </div>

          {/* Action chips */}
          <div className="flex flex-wrap gap-2">
            {actions.map(({ label, icon: Icon, href }) => (
              <button
                key={label}
                onClick={() => router.push(href)}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Big profit number */}
        <div className="text-end flex-shrink-0">
          <p className="text-xs text-gray-400 mb-1">{lang === "he" ? "רווח חודשי" : "Monthly profit"}</p>
          <p className={`text-3xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(profit)}
          </p>
          {profitChange !== null && (
            <p className={`text-sm mt-1 ${profitChange >= 0 ? "text-green-500" : "text-red-400"}`}>
              {profitChange >= 0 ? "▲" : "▼"} {Math.abs(profitChange).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
