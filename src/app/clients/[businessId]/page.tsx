"use client";

import { Fragment, use, useEffect, useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import AppShell from "@/components/AppShell";
import { getTransactions } from "@/lib/store";
import TimeFilter from "@/components/tabs/TimeFilter";
import KPICard from "@/components/shared/KPICard";
import AIInsightPanel from "@/components/shared/AIInsightPanel";
import SearchFilter from "@/components/shared/SearchFilter";
import {
  buildClientGroups,
  detectClientIssues,
  filterByTimeRange,
  getPriorPeriodTxs,
  pctChange,
  ClientGroup,
  ClientIssue,
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
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { TimeRange, Transaction } from "@/types";

export default function ClientsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = use(params);
  const { lang } = useApp();
  const tr = t[lang];
  const isRTL = lang === "he";

  // ── State ──────────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<TimeRange>("3months");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "dormant" | "new">(
    "all"
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [allTxs, setAllTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    setAllTxs(getTransactions(businessId));
  }, [businessId]);

  // ── Derived data ───────────────────────────────────────────────────────
  const incomeTxs = useMemo(
    () => allTxs.filter((tx) => !tx.isExcluded && tx.amount > 0),
    [allTxs]
  );

  const currentTxs = useMemo(
    () => filterByTimeRange(incomeTxs, timeRange),
    [incomeTxs, timeRange]
  );

  const currentGroups = useMemo(
    () => buildClientGroups(currentTxs),
    [currentTxs]
  );

  const priorIncomeTxs = useMemo(() => {
    const prior = getPriorPeriodTxs(allTxs, timeRange);
    return prior.filter((tx) => !tx.isExcluded && tx.amount > 0);
  }, [allTxs, timeRange]);

  const priorGroups = useMemo(
    () => buildClientGroups(priorIncomeTxs),
    [priorIncomeTxs]
  );

  const issues = useMemo(
    () => detectClientIssues(currentGroups, priorGroups),
    [currentGroups, priorGroups]
  );

  const issueMap = useMemo(() => {
    const map = new Map<string, ClientIssue>();
    for (const issue of issues) {
      const key = issue.clientName.trim().toLowerCase();
      if (!map.has(key)) map.set(key, issue);
    }
    return map;
  }, [issues]);

  // ── KPI values ─────────────────────────────────────────────────────────
  const totalRevenue = useMemo(
    () => currentGroups.reduce((s, g) => s + g.totalReceived, 0),
    [currentGroups]
  );

  const priorTotalRevenue = useMemo(
    () => priorGroups.reduce((s, g) => s + g.totalReceived, 0),
    [priorGroups]
  );

  const revenueDelta = pctChange(totalRevenue, priorTotalRevenue);

  const uniqueClients = currentGroups.length;
  const priorUniqueClients = priorGroups.length;
  const clientCountDelta = pctChange(uniqueClients, priorUniqueClients);

  const topClient = currentGroups[0] ?? null;
  const topClientConcentration =
    topClient && totalRevenue > 0
      ? Math.round((topClient.totalReceived / totalRevenue) * 100)
      : 0;

  const dormantCount = issues.filter((i) => i.type === "dormant").length;

  // ── Filtered & searched groups ─────────────────────────────────────────
  const displayGroups = useMemo(() => {
    let groups = currentGroups;

    // Apply status filter
    if (activeFilter === "dormant") {
      const dormantKeys = new Set(
        issues.filter((i) => i.type === "dormant").map((i) => i.clientName.trim().toLowerCase())
      );
      groups = groups.filter((g) => dormantKeys.has(g.key));
    } else if (activeFilter === "new") {
      const newKeys = new Set(
        issues.filter((i) => i.type === "new").map((i) => i.clientName.trim().toLowerCase())
      );
      groups = groups.filter((g) => newKeys.has(g.key));
    }

    // Apply search query
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      groups = groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.topCategory.toLowerCase().includes(q)
      );
    }

    return groups;
  }, [currentGroups, activeFilter, issues, query]);

  // ── Chart data (top 8) ────────────────────────────────────────────────
  const chartData = useMemo(
    () =>
      currentGroups.slice(0, 8).map((g) => ({
        name: truncate(g.name, 14),
        value: Math.round(g.totalReceived),
      })),
    [currentGroups]
  );

  // ── Transactions for expanded row ──────────────────────────────────────
  const expandedTxs = useMemo(() => {
    if (!expandedKey) return [];
    return currentTxs
      .filter((tx) => tx.description.trim().toLowerCase() === expandedKey)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expandedKey, currentTxs]);

  // ── AI context string ─────────────────────────────────────────────────
  const aiContext = useMemo(() => {
    const top5 = currentGroups.slice(0, 5).map(
      (g) =>
        `${g.name}: ${g.totalReceived.toLocaleString("he-IL")} (${g.count} payments)`
    );
    return [
      `Total revenue: ${totalRevenue.toLocaleString("he-IL")}`,
      `Unique clients: ${uniqueClients}`,
      `Top client concentration: ${topClientConcentration}%`,
      `Dormant clients: ${dormantCount}`,
      `Top 5: ${top5.join("; ")}`,
    ].join("\n");
  }, [currentGroups, totalRevenue, uniqueClients, topClientConcentration, dormantCount]);

  // ── Status helpers ─────────────────────────────────────────────────────
  function getStatus(group: ClientGroup): "dormant" | "new" | "active" {
    const issue = issueMap.get(group.key);
    if (issue?.type === "dormant") return "dormant";
    if (issue?.type === "new") return "new";
    return "active";
  }

  function statusBadge(status: "dormant" | "new" | "active") {
    if (status === "dormant")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
          <UserMinus className="w-3 h-3" />
          {tr.clientDormant}
        </span>
      );
    if (status === "new")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          <UserPlus className="w-3 h-3" />
          {tr.clientNew}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
        <TrendingUp className="w-3 h-3" />
        {tr.clientActive}
      </span>
    );
  }

  // ── Formatters ─────────────────────────────────────────────────────────
  const fmt = (n: number) =>
    `\u20AA${Math.round(n).toLocaleString("he-IL")}`;

  const fmtDate = (d: string) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {tr.clientsPage}
            </h1>
          </div>
          <TimeFilter value={timeRange} onChange={setTimeRange} lang={lang} />
        </div>

        {/* AI Insight */}
        <AIInsightPanel
          businessId={businessId}
          pageType="clients"
          contextData={aiContext}
          timeRange={timeRange}
        />

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label={tr.totalClientRevenue}
            value={fmt(totalRevenue)}
            icon={<TrendingUp className="w-5 h-5" />}
            sub={
              revenueDelta !== null
                ? `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}% ${tr.vsPrior}`
                : tr.noChange
            }
            positive={revenueDelta !== null ? revenueDelta >= 0 : undefined}
          />
          <KPICard
            label={tr.uniqueClients}
            value={String(uniqueClients)}
            icon={<Users className="w-5 h-5" />}
            sub={
              clientCountDelta !== null
                ? `${clientCountDelta >= 0 ? "+" : ""}${clientCountDelta}% ${tr.vsPrior}`
                : tr.noChange
            }
            positive={
              clientCountDelta !== null ? clientCountDelta >= 0 : undefined
            }
          />
          <KPICard
            label={tr.topClient}
            value={topClient ? truncate(topClient.name, 18) : "—"}
            icon={<TrendingUp className="w-5 h-5" />}
            sub={
              topClientConcentration > 40
                ? tr.concentrationRisk.replace(
                    "{pct}",
                    String(topClientConcentration)
                  )
                : topClient
                  ? fmt(topClient.totalReceived)
                  : ""
            }
            positive={
              topClientConcentration > 40 ? false : undefined
            }
          />
          <KPICard
            label={tr.dormantClients}
            value={String(dormantCount)}
            icon={<UserMinus className="w-5 h-5" />}
            sub={
              dormantCount > 0
                ? (isRTL ? "דורש תשומת לב" : "Needs attention")
                : (isRTL ? "מצב תקין" : "Looking good")
            }
            positive={dormantCount === 0}
          />
        </div>

        {/* Search + Filters */}
        <SearchFilter
          query={query}
          onQueryChange={setQuery}
          placeholder={tr.searchClients}
          filters={[
            {
              key: "all",
              label: tr.filterAll2,
              active: activeFilter === "all",
            },
            {
              key: "dormant",
              label: tr.clientDormant,
              active: activeFilter === "dormant",
            },
            {
              key: "new",
              label: tr.clientNew,
              active: activeFilter === "new",
            },
          ]}
          onFilterToggle={(key) =>
            setActiveFilter(key as "all" | "dormant" | "new")
          }
        />

        {/* Bar Chart — Top 8 Clients */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {isRTL ? "8 לקוחות מובילים" : "Top 8 Clients"}
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tick={{ fontSize: 12, fill: "#4B5563" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [
                      fmt(Number(value)),
                      isRTL ? "הכנסה" : "Revenue",
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #E5E7EB",
                      fontSize: 13,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#10B981"
                    radius={[0, 6, 6, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Client Table */}
        {displayGroups.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{tr.noClientsPeriod}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-4 py-3 text-start font-medium text-gray-500 w-8" />
                    <th className="px-4 py-3 text-start font-medium text-gray-500">
                      {isRTL ? "לקוח" : "Client"}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-gray-500">
                      {isRTL ? "קטגוריה" : "Category"}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-gray-500">
                      {tr.totalReceived}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-gray-500">
                      {tr.payments}
                    </th>
                    <th className="px-4 py-3 text-end font-medium text-gray-500">
                      {tr.avgPayment}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-gray-500">
                      {isRTL ? "תאריך אחרון" : "Last Date"}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-gray-500">
                      {isRTL ? "סטטוס" : "Status"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayGroups.map((g) => {
                    const status = getStatus(g);
                    const isExpanded = expandedKey === g.key;
                    const avg = g.count > 0 ? g.totalReceived / g.count : 0;
                    const concentration =
                      totalRevenue > 0
                        ? Math.round((g.totalReceived / totalRevenue) * 100)
                        : 0;

                    return (
                      <Fragment key={g.key}>
                        <tr
                          className="border-b border-gray-50 hover:bg-green-50/30 cursor-pointer transition-colors"
                          onClick={() =>
                            setExpandedKey(isExpanded ? null : g.key)
                          }
                        >
                          <td className="px-4 py-3 text-gray-400">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {truncate(g.name, 28)}
                              {concentration > 40 && (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {g.topCategory ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">
                                {g.topCategory}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-end font-semibold text-green-700">
                            {fmt(g.totalReceived)}
                          </td>
                          <td className="px-4 py-3 text-end text-gray-600">
                            {g.count}
                          </td>
                          <td className="px-4 py-3 text-end text-gray-600">
                            {fmt(avg)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {fmtDate(g.lastDate)}
                          </td>
                          <td className="px-4 py-3">
                            {statusBadge(status)}
                          </td>
                        </tr>

                        {/* Expanded row — individual transactions */}
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={8}
                              className="bg-green-50/40 px-8 py-3"
                            >
                              {expandedTxs.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">
                                  {isRTL
                                    ? "אין עסקאות להצגה"
                                    : "No transactions to display"}
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400">
                                      <th className="py-1.5 text-start font-medium">
                                        {isRTL ? "תאריך" : "Date"}
                                      </th>
                                      <th className="py-1.5 text-start font-medium">
                                        {isRTL ? "תיאור" : "Description"}
                                      </th>
                                      <th className="py-1.5 text-end font-medium">
                                        {isRTL ? "סכום" : "Amount"}
                                      </th>
                                      <th className="py-1.5 text-start font-medium">
                                        {isRTL ? "קטגוריה" : "Category"}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedTxs.map((tx) => (
                                      <tr
                                        key={tx.id}
                                        className="border-t border-green-100/60"
                                      >
                                        <td className="py-1.5 text-gray-500">
                                          {fmtDate(tx.date)}
                                        </td>
                                        <td className="py-1.5 text-gray-700">
                                          {truncate(tx.description, 40)}
                                        </td>
                                        <td className="py-1.5 text-end font-medium text-green-700">
                                          {fmt(tx.amount)}
                                        </td>
                                        <td className="py-1.5 text-gray-400">
                                          {tx.category || "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
