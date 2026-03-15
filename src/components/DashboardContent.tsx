"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { groupByMonth, calcAverage, formatCurrency, formatPercent, projectCashFlow } from "@/lib/utils";
import { Business, Transaction } from "@/types";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, Upload, Lightbulb, Target, DollarSign, ChevronDown, Pencil } from "lucide-react";
import StoryCard from "./StoryCard";
import CategoryBreakdown from "./CategoryBreakdown";
import BalanceInput from "./BalanceInput";
import ForecastChart from "./ForecastChart";
import OverdraftAlert from "./OverdraftAlert";
import EditBusinessModal from "./EditBusinessModal";
import ErrorBoundary from "./ErrorBoundary";
import KPICard from "./shared/KPICard";
import { getBalance } from "@/lib/store";

interface Props {
  transactions: Transaction[];
  businessName?: string;
  businessId: string | null;
  business?: Business | null;
}

// Guided empty state
function EmptyState({ businessId, lang }: { businessId: string | null; lang: string }) {
  const tr = t[lang as "he" | "en"];
  const router = useRouter();
  const [guideOpen, setGuideOpen] = useState(false);

  const steps = [
    { num: 1, label: tr.stepDownload, icon: "🏦" },
    { num: 2, label: tr.stepUpload, icon: "📤" },
    { num: 3, label: tr.stepGetInsights, icon: "📊" },
  ];

  const bankGuide = [
    tr.bankHapoalim,
    tr.bankLeumi,
    tr.bankDiscount,
    tr.googleSheets,
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-lg mx-auto">
      <div className="text-6xl mb-4">📊</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        {tr.welcomeToBizUp}
      </h2>
      <p className="text-gray-500 mb-8">
        {tr.welcomeSubtitle}
      </p>

      {/* Steps */}
      <div className="flex gap-4 mb-8 w-full">
        {steps.map((s) => (
          <div key={s.num} className="flex-1 bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className="text-xs text-gray-600 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push(businessId ? `/upload/${businessId}` : "/upload")}
        className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 text-lg font-semibold mb-6 w-full justify-center"
      >
        <Upload className="w-5 h-5" />
        {tr.uploadFile}
      </button>

      {/* Bank guide accordion */}
      <button
        onClick={() => setGuideOpen(!guideOpen)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        {tr.howToExportGuide}
        <ChevronDown className={`w-4 h-4 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
      </button>
      {guideOpen && (
        <div className="mt-3 text-start w-full bg-gray-50 rounded-xl p-4 space-y-2">
          {bankGuide.map((line, i) => (
            <p key={i} className="text-sm text-gray-600">• {line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardContent({ transactions, businessName, businessId, business }: Props) {
  const { lang, refreshData } = useApp();
  const tr = t[lang];
  const router = useRouter();
  const forecastRef = useRef<HTMLDivElement>(null);

  const [currentBalance, setCurrentBalance] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentBusiness, setCurrentBusiness] = useState(business ?? null);

  useEffect(() => {
    if (businessId) setCurrentBalance(getBalance(businessId));
  }, [businessId]);

  const activeTxs = transactions.filter((t) => !t.isExcluded);
  const excludedCount = transactions.length - activeTxs.length;

  const stats = groupByMonth(activeTxs);
  const totalIncome = activeTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = activeTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const lastMonthStats = stats[stats.length - 1];
  const avg3 = calcAverage(stats, 3);
  const avg6 = calcAverage(stats, 6);

  const chartData = stats.map((s) => ({
    name: s.month.substring(5),
    income: s.income,
    expenses: s.expenses,
    profit: s.netProfit,
  }));

  // Budget vs target
  const targetProfit = currentBusiness?.targetMonthlyProfit ?? 0;
  const fixedCosts = currentBusiness?.fixedMonthlyCosts ?? 0;
  const lastMonthProfit = lastMonthStats?.netProfit ?? 0;
  const lastMonthExpenses = lastMonthStats?.expenses ?? 0;
  const vsBudgetGap = fixedCosts > 0 ? fixedCosts - lastMonthExpenses : null;

  // Forecast
  const forecast = currentBalance > 0
    ? projectCashFlow(transactions, currentBalance, 3, fixedCosts)
    : [];

  // Quick insights
  const insights: Array<{ text: string; positive: boolean }> = [];
  if (stats.length >= 2) {
    const prev = stats[stats.length - 2];
    const curr = stats[stats.length - 1];
    if (curr && prev) {
      const profitChange = ((curr.netProfit - prev.netProfit) / Math.abs(prev.netProfit || 1)) * 100;
      if (Math.abs(profitChange) > 5) {
        insights.push({
          text: lang === "he"
            ? `הרווח ${profitChange > 0 ? "עלה" : "ירד"} ב-${Math.abs(profitChange).toFixed(0)}% לעומת חודש קודם`
            : `Profit ${profitChange > 0 ? "increased" : "decreased"} by ${Math.abs(profitChange).toFixed(0)}% vs last month`,
          positive: profitChange > 0,
        });
      }
      const expChange = ((curr.expenses - prev.expenses) / (prev.expenses || 1)) * 100;
      if (expChange > 10) {
        insights.push({
          text: lang === "he"
            ? `ההוצאות עלו ב-${expChange.toFixed(0)}% — כדאי לבדוק`
            : `Expenses rose by ${expChange.toFixed(0)}% — worth reviewing`,
          positive: false,
        });
      }
    }
  }
  if (profitMargin < 10 && activeTxs.length > 0) {
    insights.push({
      text: lang === "he"
        ? `מרווח הרווח (${profitMargin.toFixed(1)}%) נמוך — שקול הפחתת עלויות`
        : `Profit margin (${profitMargin.toFixed(1)}%) is low — consider reducing costs`,
      positive: false,
    });
  }

  if (transactions.length === 0) {
    return <EmptyState businessId={businessId} lang={lang} />;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Overdraft alert */}
      {forecast.length > 0 && (
        <OverdraftAlert
          forecast={forecast}
          onViewForecast={() => forecastRef.current?.scrollIntoView({ behavior: "smooth" })}
        />
      )}

      {/* Story card */}
      <ErrorBoundary>
        <StoryCard transactions={transactions} businessId={businessId ?? ""} />
      </ErrorBoundary>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {currentBusiness?.logo && (
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                <img src={currentBusiness.logo} alt={currentBusiness.name} className="w-full h-full object-cover" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-gray-900">{currentBusiness?.name || businessName || tr.dashboard}</h1>
            {currentBusiness && (
              <button
                onClick={() => setShowEditModal(true)}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                title={tr.editBusiness}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-gray-500 mt-1">{tr.tagline}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(businessId ? `/upload/${businessId}` : "/upload")}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            {tr.upload}
          </button>
          <button
            onClick={() => router.push(businessId ? `/insights/${businessId}` : "/insights")}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"
          >
            <Lightbulb className="w-4 h-4" />
            {tr.insights}
          </button>
        </div>
      </div>

      {/* KPI Grid — main */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard
          label={tr.netProfit}
          value={formatCurrency(netProfit)}
          sub={`${tr.profitMargin}: ${formatPercent(profitMargin)}`}
          positive={netProfit >= 0}
          accent={netProfit > 0}
        />
        <KPICard label={tr.income} value={formatCurrency(totalIncome)} />
        <KPICard label={tr.expenses} value={formatCurrency(totalExpenses)} positive={false} />
        <KPICard
          label={tr.lastMonth}
          value={formatCurrency(lastMonthStats?.netProfit ?? 0)}
          positive={(lastMonthStats?.netProfit ?? 0) >= 0}
        />
      </div>

      {excludedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 mb-6">
          <span>🔕</span>
          <span>
            {((tr as Record<string, string>).excludedBadge).replace("{n}", String(excludedCount))}
          </span>
          <span className="text-gray-400">·</span>
          <span>{lang === "he" ? "הלוואות בעלים / דיבידנדים" : "owner loans / dividends"}</span>
        </div>
      )}

      {/* KPI Grid — averages + budget */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard label={tr.avg3} value={formatCurrency(avg3)} positive={avg3 >= 0} />
        <KPICard label={tr.avg6} value={formatCurrency(avg6)} positive={avg6 >= 0} />
        {/* Goal progress */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          {targetProfit > 0 ? (() => {
            const progress = Math.min((lastMonthProfit / targetProfit) * 100, 100);
            const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            const daysLeft = daysInMonth - new Date().getDate();
            return (
              <>
                <p className="text-sm text-gray-500 mb-2">{tr.goalProgress}</p>
                <p className={`text-2xl font-bold mb-1 ${lastMonthProfit >= targetProfit ? "text-green-600" : lastMonthProfit >= targetProfit * 0.5 ? "text-amber-600" : "text-red-500"}`}>
                  {formatCurrency(lastMonthProfit)}
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  {tr.goalProgressOf} {formatCurrency(targetProfit)} · {daysLeft} {tr.goalDaysLeft}
                </p>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${progress >= 80 ? "bg-green-500" : progress >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-end">{Math.round(progress)}%</p>
              </>
            );
          })() : (
            <div className="flex flex-col items-center justify-center h-full min-h-[80px] cursor-pointer" onClick={() => setShowEditModal(true)}>
              <Target className="w-5 h-5 text-gray-400 mb-1" />
              <p className="text-xs text-gray-400 text-center">{tr.goalSetTarget}</p>
            </div>
          )}
        </div>
        {vsBudgetGap !== null ? (
          <KPICard
            label={tr.fixedCostsBurn}
            value={formatCurrency(fixedCosts)}
            sub={`${vsBudgetGap >= 0 ? tr.underBudget : tr.overBudget}: ${formatCurrency(Math.abs(vsBudgetGap))}`}
            positive={vsBudgetGap >= 0}
          />
        ) : (
          <div
            className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => router.push("/")}
          >
            <DollarSign className="w-5 h-5 text-gray-400 mb-1" />
            <p className="text-xs text-gray-400 text-center">{tr.fixedCosts}</p>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">{tr.profitTrend}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [formatCurrency(Number(v))]} />
              <ReferenceLine y={0} stroke="#666" />
              <Bar dataKey="profit" fill="#3b82f6" radius={[4, 4, 0, 0]} name={tr.netProfit} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">{tr.cashFlow}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [formatCurrency(Number(v))]} />
              <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={false} name={tr.income} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name={tr.expenses} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown */}
      {transactions.some((t) => t.category) && (
        <div className="mb-8">
          <ErrorBoundary>
            <CategoryBreakdown transactions={transactions} />
          </ErrorBoundary>
        </div>
      )}

      {/* Quick insights */}
      {insights.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-amber-800">{tr.quickInsights}</h3>
          </div>
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-amber-700 text-sm">
                {ins.positive
                  ? <TrendingUp className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                  : <TrendingDown className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                }
                {ins.text}
              </li>
            ))}
          </ul>
          <button
            onClick={() => router.push(businessId ? `/insights/${businessId}` : "/insights")}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {tr.viewAllInsights} →
          </button>
        </div>
      )}

      {/* Forecast section */}
      <div ref={forecastRef} id="forecast" className="space-y-4 mb-8">
        <BalanceInput
          businessId={businessId ?? ""}
          onChange={(bal) => setCurrentBalance(bal)}
        />
        {forecast.length > 0 && (
          <ErrorBoundary>
            <ForecastChart data={forecast} />
          </ErrorBoundary>
        )}
      </div>

      {showEditModal && currentBusiness && (
        <EditBusinessModal
          business={currentBusiness}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setCurrentBusiness(updated);
            setShowEditModal(false);
            refreshData();
          }}
        />
      )}
    </div>
  );
}
