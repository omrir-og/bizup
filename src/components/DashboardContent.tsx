"use client";

import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { groupByMonth, calcAverage, formatCurrency, formatPercent } from "@/lib/utils";
import { Transaction } from "@/types";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, Upload, Lightbulb } from "lucide-react";

interface Props {
  transactions: Transaction[];
  businessName?: string;
  businessId: string | null;
}

function KPICard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <p className="text-gray-500 text-sm mb-2">{label}</p>
      <p className={`text-2xl font-bold ${positive === undefined ? "text-gray-900" : positive ? "text-green-600" : "text-red-600"}`}>
        {value}
      </p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardContent({ transactions, businessName, businessId }: Props) {
  const { lang } = useApp();
  const tr = t[lang];
  const router = useRouter();

  const stats = groupByMonth(transactions);
  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const lastMonthStats = stats[stats.length - 1];
  const avg3 = calcAverage(stats, 3);
  const avg6 = calcAverage(stats, 6);

  const chartData = stats.map((s) => ({
    name: s.month.substring(5), // MM
    income: s.income,
    expenses: s.expenses,
    profit: s.netProfit,
  }));

  // Simple AI insights based on data
  const insights: string[] = [];
  if (stats.length >= 2) {
    const prev = stats[stats.length - 2];
    const curr = stats[stats.length - 1];
    if (curr && prev) {
      const profitChange = ((curr.netProfit - prev.netProfit) / Math.abs(prev.netProfit || 1)) * 100;
      if (Math.abs(profitChange) > 5) {
        insights.push(
          lang === "he"
            ? `הרווח ${profitChange > 0 ? "עלה" : "ירד"} ב-${Math.abs(profitChange).toFixed(0)}% לעומת חודש קודם`
            : `Profit ${profitChange > 0 ? "increased" : "decreased"} by ${Math.abs(profitChange).toFixed(0)}% vs last month`
        );
      }
      const expChange = ((curr.expenses - prev.expenses) / (prev.expenses || 1)) * 100;
      if (expChange > 10) {
        insights.push(
          lang === "he"
            ? `ההוצאות עלו ב-${expChange.toFixed(0)}% - כדאי לבדוק`
            : `Expenses rose by ${expChange.toFixed(0)}% - worth reviewing`
        );
      }
    }
  }
  if (profitMargin < 10 && transactions.length > 0) {
    insights.push(
      lang === "he"
        ? `מרווח הרווח (${profitMargin.toFixed(1)}%) נמוך - שקול הפחתת עלויות`
        : `Profit margin (${profitMargin.toFixed(1)}%) is low - consider reducing costs`
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-gray-700 mb-2">{tr.noData}</h2>
        <p className="text-gray-400 mb-6">{tr.uploadFirst}</p>
        <button
          onClick={() => router.push(businessId ? `/upload/${businessId}` : "/upload")}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700"
        >
          <Upload className="w-5 h-5" />
          {tr.uploadFile}
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{businessName || tr.dashboard}</h1>
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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          label={tr.netProfit}
          value={formatCurrency(netProfit)}
          sub={`${tr.profitMargin}: ${formatPercent(profitMargin)}`}
          positive={netProfit >= 0}
        />
        <KPICard label={tr.income} value={formatCurrency(totalIncome)} />
        <KPICard label={tr.expenses} value={formatCurrency(totalExpenses)} positive={false} />
        <KPICard
          label={tr.lastMonth}
          value={formatCurrency(lastMonthStats?.netProfit ?? 0)}
          positive={(lastMonthStats?.netProfit ?? 0) >= 0}
        />
      </div>

      {/* Comparison row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <KPICard label={tr.avg3} value={formatCurrency(avg3)} positive={avg3 >= 0} />
        <KPICard label={tr.avg6} value={formatCurrency(avg6)} positive={avg6 >= 0} />
        <KPICard label={tr.allTime} value={formatCurrency(netProfit)} positive={netProfit >= 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Profit Trend */}
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

        {/* Cash Flow */}
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

      {/* Quick Insights */}
      {insights.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-amber-800">{tr.quickInsights}</h3>
          </div>
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-amber-700 text-sm">
                {ins.includes("עלה") || ins.includes("increased") ? (
                  <TrendingUp className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                ) : (
                  <TrendingDown className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                )}
                {ins}
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
    </div>
  );
}
