"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import AppShell from "@/components/AppShell";
import { getTransactions } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import TimeFilter from "@/components/tabs/TimeFilter";
import KPICard from "@/components/shared/KPICard";
import AIInsightPanel from "@/components/shared/AIInsightPanel";
import SearchFilter from "@/components/shared/SearchFilter";
import {
  buildSupplierGroups,
  detectSupplierAnomalies,
  filterByTimeRange,
  getPriorPeriodTxs,
  pctChange,
  SupplierGroup,
  SupplierAnomaly,
} from "@/lib/dataUtils";
import { truncate } from "@/components/tabs/tabUtils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Truck,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Hash,
} from "lucide-react";
import { TimeRange, Transaction } from "@/types";

export default function SuppliersPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = use(params);
  const { lang, setSelectedBusinessId, businesses, transactions } = useApp();
  const tr = t[lang];

  useEffect(() => {
    setSelectedBusinessId(businessId);
  }, [businessId, setSelectedBusinessId]);

  const [timeRange, setTimeRange] = useState<TimeRange>("3months");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "anomalies" | "new"
  >("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const allTxs = useMemo(
    () => getTransactions(businessId),
    [businessId],
  );

  const {
    currentGroups,
    priorGroups,
    anomalies,
    anomalyMap,
    filteredGroups,
    currentTxs,
    totalSpend,
    priorTotalSpend,
  } = useMemo(() => {
    // Filter expense transactions only
    const expenseTxs = allTxs.filter(
      (tx) => !tx.isExcluded && tx.amount < 0,
    );

    // Current period
    const currentTxs = filterByTimeRange(expenseTxs, timeRange);
    const currentGroups = buildSupplierGroups(currentTxs);

    // Prior period
    const priorExpenseTxs = getPriorPeriodTxs(expenseTxs, timeRange);
    const priorGroups = buildSupplierGroups(priorExpenseTxs);

    // Anomalies
    const anomalies = detectSupplierAnomalies(currentGroups, priorGroups);
    const anomalyMap = new Map<string, SupplierAnomaly>();
    for (const a of anomalies) {
      const key = currentGroups.find(
        (g) => g.name === a.supplierName,
      )?.key;
      if (key) anomalyMap.set(key, a);
    }

    // Totals
    const totalSpend = currentGroups.reduce(
      (sum, g) => sum + g.totalSpent,
      0,
    );
    const priorTotalSpend = priorGroups.reduce(
      (sum, g) => sum + g.totalSpent,
      0,
    );

    // Filter by search query and activeFilter
    const filteredGroups = currentGroups.filter((g) => {
      const matchesQuery =
        !query ||
        g.name.toLowerCase().includes(query.toLowerCase()) ||
        g.topCategory.toLowerCase().includes(query.toLowerCase());

      if (!matchesQuery) return false;

      if (activeFilter === "anomalies") {
        return anomalyMap.has(g.key);
      }
      if (activeFilter === "new") {
        const a = anomalyMap.get(g.key);
        return a?.type === "new";
      }
      return true;
    });

    return {
      currentGroups,
      priorGroups,
      anomalies,
      anomalyMap,
      filteredGroups,
      currentTxs,
      totalSpend,
      priorTotalSpend,
    };
  }, [allTxs, timeRange, query, activeFilter]);

  // KPI computations
  const spendChange = pctChange(totalSpend, priorTotalSpend);
  const topSupplierName =
    currentGroups.length > 0 ? currentGroups[0].name : "—";
  const anomalyCount = anomalies.filter(
    (a) => a.type !== "missing",
  ).length;

  // Chart data — top 8 suppliers
  const chartData = useMemo(
    () =>
      currentGroups.slice(0, 8).map((g) => ({
        name: truncate(g.name, 18),
        value: g.totalSpent,
      })),
    [currentGroups],
  );

  // AI context
  const aiContext = useMemo(() => {
    const top5 = currentGroups.slice(0, 5).map((g) => ({
      name: g.name,
      spent: g.totalSpent,
      count: g.count,
      category: g.topCategory,
    }));
    return JSON.stringify({
      timeRange,
      totalSpend,
      supplierCount: currentGroups.length,
      anomalyCount,
      topSuppliers: top5,
      anomalies: anomalies.slice(0, 8),
    });
  }, [timeRange, totalSpend, currentGroups, anomalyCount, anomalies]);

  // Status badge renderer
  function statusBadge(group: SupplierGroup) {
    const anomaly = anomalyMap.get(group.key);
    if (anomaly) {
      let label: string;
      switch (anomaly.type) {
        case "spend_increase":
          label = tr.anomalySpendIncrease.replace(
            "{pct}",
            anomaly.detail,
          );
          break;
        case "large_payment":
          label = tr.anomalyLargePayment;
          break;
        case "new":
          label = tr.anomalyNewSupplier;
          break;
        case "missing":
          label = tr.anomalyMissing;
          break;
        default:
          label = anomaly.type;
      }
      if (anomaly.type === "new") {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
            NEW
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
          <AlertTriangle className="w-3 h-3" />
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200 rounded-full">
        &#10003; {tr.normal}
      </span>
    );
  }

  // Expanded row transactions
  function getSupplierTxs(key: string): Transaction[] {
    return currentTxs
      .filter(
        (tx) => tx.description.trim().toLowerCase() === key,
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {tr.suppliersPage}
            </h1>
          </div>
          <TimeFilter
            value={timeRange}
            onChange={setTimeRange}
            lang={lang}
          />
        </div>

        {/* AI Insight Panel */}
        <AIInsightPanel
          businessId={businessId}
          pageType="suppliers"
          contextData={aiContext}
          timeRange={timeRange}
        />

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label={tr.totalSupplierSpend}
            value={formatCurrency(totalSpend)}
            sub={
              spendChange !== null
                ? `${spendChange > 0 ? "+" : ""}${spendChange}% ${tr.vsPrior}`
                : tr.noChange
            }
            positive={spendChange !== null ? spendChange < 0 : undefined}
            icon={<Truck className="w-5 h-5" />}
          />
          <KPICard
            label={tr.uniqueSuppliers}
            value={String(currentGroups.length)}
            icon={<Hash className="w-5 h-5" />}
          />
          <KPICard
            label={tr.topSupplier}
            value={truncate(topSupplierName, 20)}
            sub={
              currentGroups.length > 0
                ? formatCurrency(currentGroups[0].totalSpent)
                : undefined
            }
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <KPICard
            label={tr.anomalyCount}
            value={String(anomalyCount)}
            sub={anomalyCount === 0 ? tr.noAnomalies : undefined}
            positive={anomalyCount === 0 ? true : false}
            icon={<AlertTriangle className="w-5 h-5" />}
            accent={anomalyCount > 0}
          />
        </div>

        {/* Search & Filter */}
        <SearchFilter
          query={query}
          onQueryChange={setQuery}
          placeholder={tr.searchSuppliers}
          filters={[
            {
              key: "all",
              label: tr.filterAll2,
              active: activeFilter === "all",
            },
            {
              key: "anomalies",
              label: tr.filterAnomalies,
              active: activeFilter === "anomalies",
            },
            {
              key: "new",
              label: tr.filterNew,
              active: activeFilter === "new",
            },
          ]}
          onFilterToggle={(key) =>
            setActiveFilter(key as "all" | "anomalies" | "new")
          }
        />

        {/* Bar Chart — Top 8 Suppliers */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {tr.topSuppliersDesc}
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) =>
                      `₪${(v / 1000).toFixed(0)}k`
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#9CA3AF" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#374151" }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(value as number),
                      tr.totalSupplierSpend,
                    ]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#3B82F6"
                    radius={[0, 6, 6, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Supplier Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{tr.noSuppliersPeriod}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-6 py-3 text-gray-500 font-medium w-8" />
                    <th className="px-6 py-3 text-gray-500 font-medium">
                      {tr.supplierName}
                    </th>
                    <th className="px-6 py-3 text-gray-500 font-medium">
                      {tr.categoryColumn}
                    </th>
                    <th className="px-6 py-3 text-gray-500 font-medium text-right">
                      {tr.totalSupplierSpend}
                    </th>
                    <th className="px-6 py-3 text-gray-500 font-medium text-center">
                      {tr.payments}
                    </th>
                    <th className="px-6 py-3 text-gray-500 font-medium text-right">
                      {tr.avgPayment}
                    </th>
                    <th className="px-6 py-3 text-gray-500 font-medium">
                      {tr.lastMonth}
                    </th>
                    <th className="px-6 py-3 text-gray-500 font-medium">
                      {tr.status}
                    </th>
                  </tr>
                </thead>
                {filteredGroups.map((group) => {
                  const isExpanded = expandedKey === group.key;
                  const supplierTxs = isExpanded
                    ? getSupplierTxs(group.key)
                    : [];

                  return (
                    <tbody key={group.key}>
                      <tr
                        onClick={() =>
                          setExpandedKey(isExpanded ? null : group.key)
                        }
                        className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 text-gray-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {truncate(group.name, 30)}
                        </td>
                        <td className="px-6 py-4">
                          {group.topCategory ? (
                            <span className="inline-block px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                              {group.topCategory}
                            </span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {formatCurrency(group.totalSpent)}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-600">
                          {group.count}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {formatCurrency(
                            Math.round(group.totalSpent / group.count),
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          {group.lastDate}
                        </td>
                        <td className="px-6 py-4">
                          {statusBadge(group)}
                        </td>
                      </tr>
                      {isExpanded && supplierTxs.length > 0 && (
                        <tr>
                          <td colSpan={8} className="bg-gray-50/70 px-6 py-4">
                            <div className="ml-8 space-y-1">
                              <p className="text-xs font-semibold text-gray-500 mb-2">
                                {tr.expandDetails} ({supplierTxs.length})
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400 border-b border-gray-200">
                                      <th className="py-1.5 text-left font-medium pr-4">
                                        {tr.dateColumn}
                                      </th>
                                      <th className="py-1.5 text-left font-medium pr-4">
                                        {tr.descColumn}
                                      </th>
                                      <th className="py-1.5 text-left font-medium pr-4">
                                        {tr.categoryColumn}
                                      </th>
                                      <th className="py-1.5 text-right font-medium">
                                        {tr.amountColumn}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {supplierTxs.map((tx) => (
                                      <tr
                                        key={tx.id}
                                        className="border-b border-gray-100 last:border-0"
                                      >
                                        <td className="py-1.5 text-gray-500 pr-4 whitespace-nowrap">
                                          {tx.date}
                                        </td>
                                        <td className="py-1.5 text-gray-700 pr-4">
                                          {truncate(tx.description, 40)}
                                        </td>
                                        <td className="py-1.5 text-gray-500 pr-4">
                                          {tx.category || "&mdash;"}
                                        </td>
                                        <td className="py-1.5 text-right font-medium text-red-600">
                                          {formatCurrency(tx.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    );
                  })}
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
