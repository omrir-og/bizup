"use client";

import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { Transaction } from "@/types";
import { formatCurrency, groupByCategory } from "@/lib/utils";
import { getCategoryBudgets, saveCategoryBudget } from "@/lib/store";
import { DollarSign, Check } from "lucide-react";

interface Props {
  transactions: Transaction[];
  businessId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Salaries: "#6366f1", שכר: "#6366f1",
  Rent: "#f59e0b", שכירות: "#f59e0b",
  Marketing: "#ec4899", שיווק: "#ec4899",
  Software: "#8b5cf6", תוכנה: "#8b5cf6",
  Utilities: "#14b8a6", "חשמל ומים": "#14b8a6",
  "Banking & Fees": "#64748b", "בנק ועמלות": "#64748b",
  Insurance: "#0ea5e9", ביטוח: "#0ea5e9",
  Inventory: "#f97316", מלאי: "#f97316",
  "Professional Services": "#10b981", "שירותים מקצועיים": "#10b981",
  Travel: "#a855f7", נסיעות: "#a855f7",
  Food: "#ef4444", אוכל: "#ef4444",
  Office: "#84cc16", משרד: "#84cc16",
  Other: "#94a3b8", אחר: "#94a3b8",
};

export default function CategoryBudgets({ transactions, businessId }: Props) {
  const { lang } = useApp();
  const tr = t[lang];

  const currentMonth = new Date().toISOString().substring(0, 7);
  const currentMonthTxs = transactions.filter(
    (tx) => tx.amount < 0 && tx.date.startsWith(currentMonth)
  );
  const actualByCategory = groupByCategory(currentMonthTxs);
  const budgets = getCategoryBudgets(businessId);

  const categories = Object.keys(actualByCategory).sort(
    (a, b) => actualByCategory[b] - actualByCategory[a]
  );

  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [savedBudgets, setSavedBudgets] = useState(budgets);

  if (categories.length === 0) return null;

  const handleSaveBudget = (cat: string) => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0) {
      saveCategoryBudget(businessId, cat, val);
      setSavedBudgets((prev) => ({ ...prev, [cat]: val }));
    }
    setEditingBudget(null);
    setBudgetInput("");
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-800 mb-4">{tr.categoryBudgets}</h3>
      <div className="space-y-3">
        {categories.map((cat) => {
          const actual = actualByCategory[cat] ?? 0;
          const budget = savedBudgets[cat] ?? 0;
          const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
          const isOver = budget > 0 && actual > budget;
          const isNear = budget > 0 && !isOver && pct >= 80;
          const color = CATEGORY_COLORS[cat] ?? "#94a3b8";

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-gray-800">{cat}</span>
                  {isOver && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                      {tr.overBudgetBy} {formatCurrency(actual - budget)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{formatCurrency(actual)}</span>
                  {budget > 0 && (
                    <span className="text-xs text-gray-400">/ {formatCurrency(budget)}</span>
                  )}
                  {editingBudget === cat ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveBudget(cat)}
                        className="w-20 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                        placeholder="₪"
                      />
                      <button onClick={() => handleSaveBudget(cat)} className="text-green-600 hover:text-green-700">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingBudget(cat);
                        setBudgetInput(budget > 0 ? String(budget) : "");
                      }}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                    >
                      <DollarSign className="w-3 h-3" />
                      {budget > 0 ? tr.remainingBudget : tr.setBudget}
                    </button>
                  )}
                </div>
              </div>
              {budget > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      isOver ? "bg-red-500" : isNear ? "bg-amber-400" : "bg-green-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
