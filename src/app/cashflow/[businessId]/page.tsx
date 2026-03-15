"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import AppShell from "@/components/AppShell";
import { getTransactions, getBalance } from "@/lib/store";
import KPICard from "@/components/shared/KPICard";
import AIInsightPanel from "@/components/shared/AIInsightPanel";
import {
  buildDailyBalance,
  getMonthTransactions,
  DailyBalancePoint,
} from "@/lib/dataUtils";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  Wallet,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import { Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────
interface ChartPoint {
  day: number;
  actual?: number;
  projected?: number;
  baseline?: number;
}

interface ScatterPoint {
  day: number;
  balance: number;
  name: string;
  amount: number;
}

interface SignificantEvent {
  day: number;
  name: string;
  amount: number;
  isPast: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────
function monthLabel(year: number, month: number, lang: "he" | "en"): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

function getLast6Months(): { year: number; month: number }[] {
  const now = new Date();
  const result: { year: number; month: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
}

function averageDailyBalances(
  balanceSets: DailyBalancePoint[][],
): number[] {
  if (balanceSets.length === 0) return [];
  const maxDays = Math.max(...balanceSets.map((s) => s.length));
  const result: number[] = [];
  for (let d = 0; d < maxDays; d++) {
    let sum = 0;
    let count = 0;
    for (const set of balanceSets) {
      if (d < set.length) {
        sum += set[d].balance;
        count++;
      }
    }
    result.push(count > 0 ? Math.round(sum / count) : 0);
  }
  return result;
}

// ── Page component ─────────────────────────────────────────────────────
export default function CashFlowPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = use(params);
  const { lang, setSelectedBusinessId, businesses } = useApp();
  const tr = t[lang];

  useEffect(() => {
    setSelectedBusinessId(businessId);
  }, [businessId, setSelectedBusinessId]);

  const biz = businesses.find((b) => b.id === businessId);

  // ── State ──────────────────────────────────────────────────────────
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [baseline, setBaseline] = useState<"lastMonth" | "avg3" | "avg6">(
    "avg3",
  );

  const months = useMemo(() => getLast6Months(), []);

  // ── Data ───────────────────────────────────────────────────────────
  const allTxs = useMemo(() => getTransactions(businessId), [businessId]);
  const openingBalance = useMemo(() => getBalance(businessId) ?? 0, [businessId]);

  const monthTxs = useMemo(
    () => getMonthTransactions(allTxs, selectedMonth.year, selectedMonth.month),
    [allTxs, selectedMonth.year, selectedMonth.month],
  );

  const dailyBalance = useMemo(
    () =>
      buildDailyBalance(
        monthTxs,
        openingBalance,
        selectedMonth.year,
        selectedMonth.month,
      ),
    [monthTxs, openingBalance, selectedMonth.year, selectedMonth.month],
  );

  const isCurrentMonth =
    selectedMonth.year === now.getFullYear() &&
    selectedMonth.month === now.getMonth();

  const todayDay = isCurrentMonth ? now.getDate() : 0;

  // ── Baseline computation ───────────────────────────────────────────
  const baselineValues = useMemo(() => {
    const getMonthBalance = (offsetFromSelected: number) => {
      const d = new Date(
        selectedMonth.year,
        selectedMonth.month - offsetFromSelected,
        1,
      );
      const txs = getMonthTransactions(allTxs, d.getFullYear(), d.getMonth());
      return buildDailyBalance(txs, openingBalance, d.getFullYear(), d.getMonth());
    };

    if (baseline === "lastMonth") {
      const prev = getMonthBalance(1);
      return prev.map((p) => p.balance);
    }
    if (baseline === "avg3") {
      const sets = [1, 2, 3].map((i) => getMonthBalance(i));
      return averageDailyBalances(sets);
    }
    // avg6
    const sets = [1, 2, 3, 4, 5, 6].map((i) => getMonthBalance(i));
    return averageDailyBalances(sets);
  }, [allTxs, openingBalance, selectedMonth.year, selectedMonth.month, baseline]);

  // ── Chart data ─────────────────────────────────────────────────────
  const { chartData, incomeScatter, expenseScatter, minBalance } =
    useMemo(() => {
      const points: ChartPoint[] = [];
      const incPts: ScatterPoint[] = [];
      const expPts: ScatterPoint[] = [];
      let min = Infinity;

      for (const dp of dailyBalance) {
        const isPast = todayDay === 0 || dp.day <= todayDay;
        const isFuture = isCurrentMonth && dp.day > todayDay;

        const point: ChartPoint = { day: dp.day };

        if (isPast) {
          point.actual = dp.balance;
        }
        if (isFuture) {
          point.projected = dp.balance;
        }
        // Bridge: on today's day, show both actual and projected so lines connect
        if (isCurrentMonth && dp.day === todayDay) {
          point.projected = dp.balance;
        }

        // Baseline
        if (dp.day - 1 < baselineValues.length) {
          point.baseline = baselineValues[dp.day - 1];
        }

        points.push(point);

        if (dp.balance < min) min = dp.balance;

        // Scatter for events
        for (const ev of dp.incomeEvents) {
          incPts.push({
            day: dp.day,
            balance: dp.balance,
            name: ev.name,
            amount: ev.amount,
          });
        }
        for (const ev of dp.expenseEvents) {
          expPts.push({
            day: dp.day,
            balance: dp.balance,
            name: ev.name,
            amount: ev.amount,
          });
        }
      }

      return {
        chartData: points,
        incomeScatter: incPts,
        expenseScatter: expPts,
        minBalance: min === Infinity ? 0 : min,
      };
    }, [dailyBalance, todayDay, isCurrentMonth, baselineValues]);

  // ── KPIs ───────────────────────────────────────────────────────────
  const currentBalance = useMemo(() => {
    if (todayDay > 0 && todayDay <= dailyBalance.length) {
      return dailyBalance[todayDay - 1].balance;
    }
    if (dailyBalance.length > 0) {
      return dailyBalance[dailyBalance.length - 1].balance;
    }
    return openingBalance;
  }, [dailyBalance, todayDay, openingBalance]);

  const projectedEnd = useMemo(() => {
    if (dailyBalance.length > 0) {
      return dailyBalance[dailyBalance.length - 1].balance;
    }
    return openingBalance;
  }, [dailyBalance, openingBalance]);

  const netFlow = projectedEnd - openingBalance;

  // ── Negative balance alert ─────────────────────────────────────────
  const negativeDay = useMemo(() => {
    const found = dailyBalance.find((dp) => dp.balance < 0);
    return found ?? null;
  }, [dailyBalance]);

  // ── Significant events ────────────────────────────────────────────
  const { significantIncome, significantExpenses } = useMemo(() => {
    const incomeEvents: SignificantEvent[] = [];
    const expenseEvents: SignificantEvent[] = [];

    for (const dp of dailyBalance) {
      const isPast = todayDay === 0 || dp.day <= todayDay;
      for (const ev of dp.incomeEvents) {
        incomeEvents.push({
          day: dp.day,
          name: ev.name,
          amount: ev.amount,
          isPast,
        });
      }
      for (const ev of dp.expenseEvents) {
        expenseEvents.push({
          day: dp.day,
          name: ev.name,
          amount: ev.amount,
          isPast,
        });
      }
    }

    // Filter: > 5000 or top 5
    const filterSignificant = (events: SignificantEvent[]) => {
      const large = events.filter((e) => e.amount > 5000);
      if (large.length >= 5) return large.sort((a, b) => b.amount - a.amount);
      return events
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
    };

    return {
      significantIncome: filterSignificant(incomeEvents),
      significantExpenses: filterSignificant(expenseEvents),
    };
  }, [dailyBalance, todayDay]);

  // ── AI context ─────────────────────────────────────────────────────
  const aiContext = useMemo(() => {
    return JSON.stringify({
      month: monthLabel(selectedMonth.year, selectedMonth.month, "en"),
      openingBalance,
      currentBalance,
      projectedEnd,
      netFlow,
      negativeDay: negativeDay
        ? { day: negativeDay.day, balance: negativeDay.balance }
        : null,
      significantIncome: significantIncome.slice(0, 5),
      significantExpenses: significantExpenses.slice(0, 5),
      transactionCount: monthTxs.length,
    });
  }, [
    selectedMonth,
    openingBalance,
    currentBalance,
    projectedEnd,
    netFlow,
    negativeDay,
    significantIncome,
    significantExpenses,
    monthTxs.length,
  ]);

  // ── Custom tooltip ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-sm">
        <p className="font-medium text-gray-700 mb-1">
          {lang === "he" ? `יום ${label}` : `Day ${label}`}
        </p>
        {payload.map(
          (
            entry: { name: string; value: number; color: string },
            i: number,
          ) => (
            <p key={i} style={{ color: entry.color }} className="text-xs">
              {entry.name === "actual"
                ? tr.actual
                : entry.name === "projected"
                  ? tr.projected
                  : entry.name === "baseline"
                    ? baseline === "lastMonth"
                      ? tr.baselineLastMonth
                      : baseline === "avg3"
                        ? tr.baselineAvg3
                        : tr.baselineAvg6
                    : entry.name}
              : {formatCurrency(entry.value)}
            </p>
          ),
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header + month selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {tr.cashFlowPage}
            </h1>
            <p className="text-gray-500 mt-1">{biz?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={`${selectedMonth.year}-${selectedMonth.month}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                setSelectedMonth({ year: y, month: m });
              }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
            >
              {months.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {monthLabel(m.year, m.month, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Baseline toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
          {(["lastMonth", "avg3", "avg6"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBaseline(b)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                baseline === b
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {b === "lastMonth"
                ? tr.baselineLastMonth
                : b === "avg3"
                  ? tr.baselineAvg3
                  : tr.baselineAvg6}
            </button>
          ))}
        </div>

        {/* Negative balance alert */}
        {negativeDay && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3 mb-5">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">
              {tr.negativeBalanceAlert
                .replace("{amount}", Math.abs(negativeDay.balance).toLocaleString())
                .replace("{day}", String(negativeDay.day))}
            </p>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <KPICard
            label={tr.currentBalance}
            value={formatCurrency(currentBalance)}
            positive={currentBalance >= 0}
            icon={<Wallet className="w-5 h-5" />}
            sub={`${tr.openingBalance}: ${formatCurrency(openingBalance)}`}
          />
          <KPICard
            label={tr.projectedEndOfMonth}
            value={formatCurrency(projectedEnd)}
            positive={projectedEnd >= 0}
            icon={<Calendar className="w-5 h-5" />}
          />
          <KPICard
            label={tr.netFlowProjected}
            value={`${netFlow >= 0 ? "+" : ""}${formatCurrency(netFlow)}`}
            positive={netFlow >= 0}
            icon={
              netFlow >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )
            }
          />
        </div>

        {/* Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {tr.dailyBalance}
          </h2>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 || v <= -1000
                      ? `${(v / 1000).toFixed(0)}K`
                      : String(v)
                  }
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Baseline */}
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="#9CA3AF"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  dot={false}
                  name="baseline"
                  connectNulls={false}
                />

                {/* Actual balance */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                  name="actual"
                  connectNulls={false}
                />

                {/* Projected balance */}
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="#818cf8"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  dot={false}
                  name="projected"
                  connectNulls={false}
                />

                {/* Income scatter */}
                <Scatter
                  data={incomeScatter}
                  fill="#22c55e"
                  name={tr.income}
                  dataKey="balance"
                  shape="circle"
                  legendType="none"
                />

                {/* Expense scatter */}
                <Scatter
                  data={expenseScatter}
                  fill="#ef4444"
                  name={tr.expenses}
                  dataKey="balance"
                  shape="circle"
                  legendType="none"
                />

                {/* Zero reference line (only if balance goes negative) */}
                {minBalance < 0 && (
                  <ReferenceLine
                    y={0}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}

                {/* Today reference line */}
                {isCurrentMonth && todayDay > 0 && (
                  <ReferenceLine
                    x={todayDay}
                    stroke="#eab308"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: tr.today,
                      position: "top",
                      fill: "#eab308",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insight Panel */}
        <div className="mb-6">
          <AIInsightPanel
            businessId={businessId}
            pageType="cashflow"
            contextData={aiContext}
            timeRange={`${selectedMonth.year}-${selectedMonth.month}`}
          />
        </div>

        {/* Significant events — two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Income events */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <h3 className="font-semibold text-gray-800">
                {tr.incomeEvents}
              </h3>
            </div>
            {significantIncome.length === 0 ? (
              <p className="text-sm text-gray-400">{tr.noData}</p>
            ) : (
              <div className="space-y-2">
                {significantIncome.map((ev, i) => (
                  <div
                    key={`inc-${i}`}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-gray-400 font-mono w-8 flex-shrink-0">
                        {lang === "he" ? `${ev.day}` : `${ev.day}`}
                      </span>
                      <span className="text-sm text-gray-700 truncate">
                        {ev.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-green-600">
                        +{formatCurrency(ev.amount)}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          ev.isPast
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {ev.isPast ? tr.completed : tr.expected}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense events */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-gray-800">
                {tr.expenseEvents}
              </h3>
            </div>
            {significantExpenses.length === 0 ? (
              <p className="text-sm text-gray-400">{tr.noData}</p>
            ) : (
              <div className="space-y-2">
                {significantExpenses.map((ev, i) => (
                  <div
                    key={`exp-${i}`}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-gray-400 font-mono w-8 flex-shrink-0">
                        {ev.day}
                      </span>
                      <span className="text-sm text-gray-700 truncate">
                        {ev.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-red-600">
                        -{formatCurrency(ev.amount)}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          ev.isPast
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {ev.isPast ? tr.completed : tr.expected}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
