"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { getBalance, setBalance, getBalanceUpdatedAt } from "@/lib/store";
import { Wallet, Check } from "lucide-react";

interface Props {
  businessId: string;
  onChange?: (balance: number) => void;
}

export default function BalanceInput({ businessId, onChange }: Props) {
  const { lang } = useApp();
  const tr = t[lang];
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const bal = getBalance(businessId);
    if (bal > 0) setValue(String(bal));
    setUpdatedAt(getBalanceUpdatedAt(businessId));
  }, [businessId]);

  const handleSave = () => {
    const num = parseFloat(value.replace(/[,₪\s]/g, ""));
    if (isNaN(num)) return;
    setBalance(businessId, num);
    setUpdatedAt(new Date().toISOString());
    setSaved(true);
    onChange?.(num);
    setTimeout(() => setSaved(false), 2000);
  };

  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" })
    : null;

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-5 h-5 text-blue-500" />
        <h4 className="font-semibold text-blue-800">{tr.currentBalance}</h4>
      </div>
      <p className="text-sm text-blue-600 mb-3">{tr.enterBalance}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute start-3 top-2.5 text-gray-500 text-sm">₪</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="0"
            className="w-full ps-8 pe-4 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <button
          onClick={handleSave}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            saved
              ? "bg-green-500 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {saved ? <Check className="w-4 h-4" /> : tr.save}
        </button>
      </div>
      {formattedDate && (
        <p className="text-xs text-blue-400 mt-2">
          {tr.lastUpdated}: {formattedDate}
        </p>
      )}
    </div>
  );
}
