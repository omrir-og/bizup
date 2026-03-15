"use client";

import { use, useState, useMemo, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import AppShell from "@/components/AppShell";
import { getTransactions } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import TimeFilter from "@/components/tabs/TimeFilter";
import KPICard from "@/components/shared/KPICard";
import AIInsightPanel from "@/components/shared/AIInsightPanel";
import {
  buildCategoryGroups,
  buildCategoryTrend,
  getPriorPeriodTxs,
  filterByTimeRange,
  pctChange,
  EXPENSE_COLORS,
  INCOME_COLORS,
  getProfitTypeLabel,
  getProfitTypeBadgeClass,
} from "@/lib/dataUtils";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  Layers,
  Hash,
} from "lucide-react";
import { TimeRange } from "@/types";

type ViewType = "expense" | "income" | "both";

export default function CategoriesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = use(params);
  const { lang, setSelectedBusinessId } = useApp();
  const tr = t[lang];

  useEffect(() => {
    setSelectedBusinessId(businessId);
  }, [businessId, setSelectedBusinessId]);

  const [timeRange, setTimeRange] = useState<TimeRange>("3months");
  const [type, setType] = useState<ViewType>("expense");

  const txs = getTransactions(businessId);

  const {
    filteredTxs,
    groups,
    priorGroups,
    totalAmount,
    priorTotalAmount,
    totalChangePct,
    categoryCount,
    largestGroup,
    netCashFlow,
    momChangePct,
    donutData,
    donutColors,
    rankedList,
    totalForPercent,
    trendData,
    trendCategories,
    trendColors,
    contextSummary,
  } = useMemo(() => {
    const active = txs.filter((tx) => !tx.isExcluded);
    const filtered = filterByTimeRange(active, timeRange);
    const prior = getPriorPeriodTxs(active, timeRange);

    // Build groups for current and prior period
    const otherLabel = tr.otherCategory;

    const expenseGroups = buildCategoryGroups(filtered, "expense", otherLabel);
    const incomeGroups = buildCategoryGroups(filtered, "income", otherLabel);
    const priorExpenseGroups = buildCategoryGroups(prior, "expense", otherLabel);
    const priorIncomeGroups = buildCategoryGroups(prior, "income", otherLabel);

    let groups = expenseGroups;
    let priorGrps = priorExpenseGroups;

    if (type === "income") {
      groups = incomeGroups;
      priorGrps = priorIncomeGroups;
    } else if (type === "both") {
      // For "both" mode, show the larger side in ranked list / donut
      const expTotal = expenseGroups.reduce((s, g) => s + g.total, 0);
      const incTotal = incomeGroups.reduce((s, g) => s + g.total, 0);
      groups = expTotal >= incTotal ? expenseGroups : incomeGroups;
      priorGrps = expTotal >= incTotal ? priorExpenseGroups : priorIncomeGroups;
    }

    const totalAmt = groups.reduce((s, g) => s + g.total, 0);
    const priorTotalAmt = priorGrps.reduce((s, g) => s + g.total, 0);
    const changePct = pctChange(totalAmt, priorTotalAmt);

    const catCount = groups.length;
    const largest = groups[0] ?? null;

    // Net cash flow (for "both" mode)
    const incomeTotal = incomeGroups.reduce((s, g) => s + g.total, 0);
    const expenseTotal = expenseGroups.reduce((s, g) => s + g.total, 0);
    const net = incomeTotal - expenseTotal;

    // Month-over-month: compare current total to prior total
    const momPct = pctChange(totalAmt, priorTotalAmt);

    // Donut: top 8 categories
    const top8 = groups.slice(0, 8);
    const remaining = groups.slice(8);
    const donutEntries = [...top8];
    if (remaining.length > 0) {
      donutEntries.push({
        key: "__rest__",
        name: tr.otherCategory,
        total: remaining.reduce((s, g) => s + g.total, 0),
        count: remaining.reduce((s, g) => s + g.count, 0),
      });
    }

    const colors =
      type === "income"
        ? INCOME_COLORS
        : type === "both"
          ? [...EXPENSE_COLORS.slice(0, 4), ...INCOME_COLORS.slice(0, 4)]
          : EXPENSE_COLORS;

    // Trend data
    const trendType = type === "both" ? "expense" : type;
    const trend = buildCategoryTrend(filtered, trendType, 6);

    // Get unique category keys from trend data
    const trendCatSet = new Set<string>();
    for (const point of trend) {
      for (const key of Object.keys(point)) {
        if (key !== "month") trendCatSet.add(key);
      }
    }
    const trendCats = Array.from(trendCatSet);
    const trendCols =
      type === "income" ? INCOME_COLORS : EXPENSE_COLORS;

    // Context data for AI
    const topCats = groups
      .slice(0, 6)
      .map(
        (g) =>
          `${g.name}: ${formatCurrency(g.total)} (${totalAmt > 0 ? ((g.total / totalAmt) * 100).toFixed(1) : 0}%)`
      )
      .join("; ");
    const ctx = `Category breakdown (${type}, ${timeRange}): Total ${formatCurrency(totalAmt)}. Top categories: ${topCats}. ${catCount} categories total. ${changePct !== null ? `Change vs prior: ${changePct > 0 ? "+" : ""}${changePct}%` : ""}`;

    return {
      filteredTxs: filtered,
      groups,
      priorGroups: priorGrps,
      totalAmount: totalAmt,
      priorTotalAmount: priorTotalAmt,
      totalChangePct: changePct,
      categoryCount: catCount,
      largestGroup: largest,
      netCashFlow: net,
      momChangePct: momPct,
      donutData: donutEntries,
      donutColors: colors,
      rankedList: groups,
      totalForPercent: totalAmt,
      trendData: trend,
      trendCategories: trendCats,
      trendColors: trendCols,
      contextSummary: ctx,
    };
  }, [txs, timeRange, type, tr, lang]);

  const fmtCurrency = (v: number) =>
    "\u20AA" + v.toLocaleString("he-IL");

  const toggleOptions: { key: ViewType; label: string }[] = [
    { key: "expense", label: tr.expensesToggle },
    { key: "income", label: tr.incomeToggle },
    { key: "both", label: tr.bothToggle },
  ];

  // KPI 4 logic
  const kpi4Label =
    type === "both" ? tr.netProfit : tr.monthOverMonth;
  const kpi4Value =
    type === "both"
      ? fmtCurrency(netCashFlow)
      : momChangePct !== null
        ? `${momChangePct > 0 ? "+" : ""}${momChangePct}%`
        : tr.noChange;
  const kpi4Positive =
    type === "both"
      ? netCashFlow >= 0
      : momChangePct !== null
        ? type === "income"
          ? momChangePct >= 0
          : momChangePct <= 0
        : undefined;
  const kpi4Sub =
    type === "both"
      ? tr.vsPrior
      : priorTotalAmount > 0
        ? `${tr.vsPrior}: ${fmtCurrency(priorTotalAmount)}`
        : undefined;

  if (filteredTxs.length === 0 && txs.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Layers className="w-12 h-12 mb-4" />
          <p className="text-lg font-medium">{tr.noData}</p>
          <p className="text-sm">{tr.uploadFirst}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {tr.categoriesPage}
          </h1>
          <TimeFilter value={timeRange} onChange={setTimeRange} lang={lang} />
        </div>

        {/* AI Insight */}
        <AIInsightPanel
          businessId={businessId}
          pageType="categories"
          contextData={contextSummary}
          timeRange={timeRange}
        />

        {/* Toggle bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {toggleOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setType(opt.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                type === opt.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label={tr.totalAmount}
            value={fmtCurrency(totalAmount)}
            icon={
              type === "income" ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )
            }
            sub={
              totalChangePct !== null
                ? `${totalChangePct > 0 ? "+" : ""}${totalChangePct}% ${tr.vsPrior}`
                : undefined
            }
            positive={
              totalChangePct !== null
                ? type === "income"
                  ? totalChangePct >= 0
                  : totalChangePct <= 0
                : undefined
            }
          />
          <KPICard
            label={tr.numberOfCategories}
            value={String(categoryCount)}
            icon={<Hash className="w-5 h-5" />}
          />
          <KPICard
            label={tr.largestCategory}
            value={largestGroup?.name ?? "—"}
            icon={<Layers className="w-5 h-5" />}
            sub={largestGroup ? fmtCurrency(largestGroup.total) : undefined}
          />
          <KPICard
            label={kpi4Label}
            value={kpi4Value}
            icon={
              type === "both" ? (
                <PieChartIcon className="w-5 h-5" />
              ) : (
                <TrendingUp className="w-5 h-5" />
              )
            }
            positive={kpi4Positive}
            sub={kpi4Sub}
          />
        </div>

        {/* No data for period */}
        {filteredTxs.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 text-center text-gray-400">
            <p className="text-lg font-medium">{tr.noDataPeriod}</p>
          </div>
        ) : (
          <>
            {/* Two-column: Donut + Ranked list */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Donut chart */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {tr.categoryDistribution}
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {donutData.map((entry, idx) => (
                          <Cell
                            key={entry.key}
                            fill={
                              donutColors[idx % donutColors.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => fmtCurrency(Number(value))}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => (
                          <span className="text-xs text-gray-600">
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Ranked list */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {tr.categoriesPage}
                </h2>
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {rankedList.map((group, idx) => {
                    const pct =
                      totalForPercent > 0
                        ? (group.total / totalForPercent) * 100
                        : 0;
                    const colorIdx = idx % donutColors.length;

                    return (
                      <div key={group.key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  donutColors[colorIdx],
                              }}
                            />
                            <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">
                              {group.name}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getProfitTypeBadgeClass(group.name)}`}
                            >
                              {getProfitTypeLabel(group.name, lang)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {fmtCurrency(group.total)}
                            </span>
                            <span className="text-xs text-gray-400 w-10 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor:
                                donutColors[colorIdx],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Trend stacked bar chart */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {tr.categoryTrend}
              </h2>
              {trendData.length > 0 && trendCategories.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: "#9CA3AF" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#9CA3AF" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000
                            ? `${(v / 1000).toFixed(0)}k`
                            : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          fmtCurrency(Number(value)),
                          String(name),
                        ]}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #E5E7EB",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => (
                          <span className="text-xs text-gray-600">
                            {value}
                          </span>
                        )}
                      />
                      {trendCategories.map((cat, idx) => (
                        <Bar
                          key={cat}
                          dataKey={cat}
                          stackId="a"
                          fill={
                            trendColors[idx % trendColors.length]
                          }
                          radius={
                            idx === trendCategories.length - 1
                              ? [4, 4, 0, 0]
                              : [0, 0, 0, 0]
                          }
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">
                  {tr.noDataPeriod}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
