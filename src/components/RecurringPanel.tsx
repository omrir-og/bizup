"use client";

import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { Transaction, RecurringItem } from "@/types";
import { formatCurrency, getRecurringItems } from "@/lib/utils";
import { getRecurringOverrides, saveRecurringOverride } from "@/lib/store";
import { RefreshCw, TrendingUp, TrendingDown, Edit2, Check, X, SkipForward } from "lucide-react";

interface Props {
  transactions: Transaction[];
  businessId: string;
}

export default function RecurringPanel({ transactions, businessId }: Props) {
  const { lang } = useApp();
  const tr = t[lang];

  const [overrides, setOverrides] = useState(() => getRecurringOverrides(businessId));
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const allItems = getRecurringItems(transactions);
  const incomeItems = allItems.filter((i) => i.type === "income");
  const expenseItems = allItems.filter((i) => i.type === "expense");

  const getEffectiveAmount = (item: RecurringItem) => {
    const ov = overrides[item.key];
    return ov?.amount ?? item.avgAmount;
  };

  const predictedIncome = incomeItems
    .filter((i) => !overrides[i.key]?.skip)
    .reduce((s, i) => s + getEffectiveAmount(i), 0);

  const predictedExpenses = expenseItems
    .filter((i) => !overrides[i.key]?.skip)
    .reduce((s, i) => s + getEffectiveAmount(i), 0);

  const predictedProfit = predictedIncome - predictedExpenses;

  const handleSaveEdit = (key: string) => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      const updated = { ...overrides, [key]: { ...overrides[key], amount: val } };
      setOverrides(updated);
      saveRecurringOverride(businessId, key, updated[key]);
    }
    setEditing(null);
    setEditValue("");
  };

  const toggleSkip = (key: string) => {
    const current = overrides[key]?.skip ?? false;
    const updated = { ...overrides, [key]: { ...overrides[key], skip: !current } };
    setOverrides(updated);
    saveRecurringOverride(businessId, key, updated[key]);
  };

  const resetOverride = (key: string) => {
    const { [key]: _, ...rest } = overrides;
    setOverrides(rest);
    saveRecurringOverride(businessId, key, {});
  };

  if (allItems.length === 0) return null;

  const ItemRow = ({ item }: { item: RecurringItem }) => {
    const ov = overrides[item.key];
    const effective = getEffectiveAmount(item);
    const isSkipped = ov?.skip;
    const isEdited = ov?.amount !== undefined;

    return (
      <div className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${isSkipped ? "opacity-40" : ""}`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">{item.description}</p>
          <p className="text-xs text-gray-400">
            {item.monthlyOccurrences} {tr.occurrences} · {lang === "he" ? "הבא:" : "Next:"} {item.nextExpected}
          </p>
        </div>

        {editing === item.key ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="number" min={0}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item.key)}
              className="w-24 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
            />
            <button onClick={() => handleSaveEdit(item.key)} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditing(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${item.type === "income" ? "text-green-600" : "text-gray-800"}`}>
              {formatCurrency(effective)}
              {isEdited && <span className="text-xs text-blue-400 ms-1">*</span>}
            </span>
            <button onClick={() => { setEditing(item.key); setEditValue(String(effective)); }} className="text-gray-300 hover:text-blue-500" title={tr.editAmount}>
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => toggleSkip(item.key)} className={`${isSkipped ? "text-amber-400" : "text-gray-300 hover:text-amber-500"}`} title={tr.skipNextMonth}>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            {(isEdited || isSkipped) && (
              <button onClick={() => resetOverride(item.key)} className="text-gray-300 hover:text-red-400" title={tr.resetOverride}>
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
      <h3 className="font-semibold text-gray-800">{tr.recurringItems}</h3>

      {/* Prediction summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: tr.predictedIncome, value: predictedIncome, color: "text-green-600", bg: "bg-green-50" },
          { label: tr.predictedExpenses, value: predictedExpenses, color: "text-red-600", bg: "bg-red-50" },
          { label: tr.predictedProfit, value: predictedProfit, color: predictedProfit >= 0 ? "text-blue-600" : "text-red-600", bg: "bg-blue-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-base font-bold ${color}`}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* Recurring income */}
      {incomeItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <h4 className="text-sm font-medium text-gray-700">{tr.recurringIncome}</h4>
          </div>
          {incomeItems.map((item) => <ItemRow key={item.key} item={item} />)}
        </div>
      )}

      {/* Recurring expenses */}
      {expenseItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-medium text-gray-700">{tr.recurringExpenses}</h4>
          </div>
          {expenseItems.map((item) => <ItemRow key={item.key} item={item} />)}
        </div>
      )}
    </div>
  );
}
