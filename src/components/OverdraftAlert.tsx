"use client";

import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { CashFlowPoint } from "@/types";
import { AlertTriangle, AlertCircle, ChevronDown } from "lucide-react";

interface Props {
  forecast: CashFlowPoint[];
  onViewForecast?: () => void;
}

export default function OverdraftAlert({ forecast, onViewForecast }: Props) {
  const { lang } = useApp();
  const tr = t[lang];

  // Find first projected month with negative balance
  const overdraftPoint = forecast.find((p) => p.isProjected && p.balance < 0);
  if (!overdraftPoint) return null;

  // Estimate days until overdraft (approximate: start of that month)
  const today = new Date();
  const overdraftDate = new Date(overdraftPoint.month + "-01");
  const daysUntil = Math.max(0, Math.ceil((overdraftDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  const isCritical = daysUntil <= 30;

  const message = isCritical
    ? tr.overdraftWarningDays.replace("{days}", String(daysUntil))
    : tr.overdraftCautionDays.replace("{days}", String(daysUntil));

  const colors = isCritical
    ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", btn: "bg-red-100 hover:bg-red-200 text-red-700", icon: AlertCircle }
    : { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", btn: "bg-amber-100 hover:bg-amber-200 text-amber-700", icon: AlertTriangle };

  const Icon = colors.icon;

  return (
    <div className={`rounded-2xl p-4 border ${colors.bg} ${colors.border} flex items-center gap-4 mb-6`}>
      <Icon className={`w-6 h-6 flex-shrink-0 ${colors.text}`} />
      <p className={`flex-1 font-medium text-sm ${colors.text}`}>{message}</p>
      {onViewForecast && (
        <button
          onClick={onViewForecast}
          className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${colors.btn}`}
        >
          {tr.viewForecast}
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
