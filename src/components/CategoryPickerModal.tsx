"use client";

import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { X, Plus, Check } from "lucide-react";

interface Props {
  businessId: string;
  industry: string;
  onClose: () => void;
}

const DEFAULT_EXPENSE_CATEGORIES_HE = [
  "שכר", "שכירות", "שיווק", "תוכנה", "חשמל ומים", "בנק ועמלות",
  "ביטוח", "מלאי", "שירותים מקצועיים", "נסיעות", "אוכל", "משרד",
];
const DEFAULT_INCOME_CATEGORIES_HE = [
  "תשלום לקוח", "הלוואה", "החזר מס", "השקעה", "מענק",
];
const DEFAULT_EXPENSE_CATEGORIES_EN = [
  "Salaries", "Rent", "Marketing", "Software", "Utilities", "Banking & Fees",
  "Insurance", "Inventory", "Professional Services", "Travel", "Food", "Office",
];
const DEFAULT_INCOME_CATEGORIES_EN = [
  "Client Payment", "Loan", "Tax Refund", "Investment", "Grant",
];

export default function CategoryPickerModal({ businessId, industry, onClose }: Props) {
  const { lang, businesses, addBusiness, refreshData } = useApp();
  const tr = t[lang];

  const defaultExpense = lang === "he" ? DEFAULT_EXPENSE_CATEGORIES_HE : DEFAULT_EXPENSE_CATEGORIES_EN;
  const defaultIncome = lang === "he" ? DEFAULT_INCOME_CATEGORIES_HE : DEFAULT_INCOME_CATEGORIES_EN;

  const [selected, setSelected] = useState<Set<string>>(new Set([...defaultExpense, ...defaultIncome]));
  const [newCat, setNewCat] = useState("");

  const toggle = (cat: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const addCustom = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    setSelected(prev => new Set([...prev, trimmed]));
    setNewCat("");
  };

  const handleSave = () => {
    // Save custom categories to business via localStorage directly
    const key = "bizup_businesses";
    try {
      const raw = localStorage.getItem(key);
      const all: import("@/types").Business[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(b => b.id === businessId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], customCategories: Array.from(selected) };
        localStorage.setItem(key, JSON.stringify(all));
        refreshData();
      }
    } catch { /* ignore */ }
    onClose();
  };

  const allCategories = [...new Set([...defaultExpense, ...defaultIncome, ...Array.from(selected)])];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {lang === "he" ? "קטגוריות לעסק" : "Business Categories"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {lang === "he"
              ? "בחר את הקטגוריות הרלוונטיות לעסק שלך. אלו ישמשו לסיווג עסקאות אוטומטי."
              : "Select the categories relevant to your business. These will be used to auto-categorize transactions."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {allCategories.map((cat) => {
            const isSelected = selected.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5" />}
                {cat}
                {isSelected && (
                  <X
                    className="w-3.5 h-3.5 opacity-70 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); toggle(cat); }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Add custom category */}
        <div className="flex gap-2 mb-6">
          <input
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={lang === "he" ? "הוסף קטגוריה חדשה..." : "Add custom category..."}
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
          />
          <button
            onClick={addCustom}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {lang === "he" ? "הוסף" : "Add"}
          </button>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            {lang === "he" ? "דלג" : "Skip"}
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {lang === "he" ? "שמור קטגוריות" : "Save Categories"}
          </button>
        </div>
      </div>
    </div>
  );
}
