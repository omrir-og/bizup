"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Language, TimeRange, Transaction } from "@/types";
import { t } from "@/lib/translations";
import { truncate, filterByTimeRange } from "./tabUtils";

interface SuppliersTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}

interface SupplierGroup {
  key: string;
  name: string;
  totalSpent: number;
  count: number;
  lastDate: string;
  topCategory: string;
}

function buildSupplierGroups(txs: Transaction[]): SupplierGroup[] {
  const map = new Map<string, {
    nameFreq: Map<string, number>;
    totalSpent: number;
    count: number;
    lastDate: string;
    catFreq: Map<string, number>;
  }>();

  for (const tx of txs) {
    const normKey = tx.description.trim().toLowerCase();
    if (!map.has(normKey)) {
      map.set(normKey, { nameFreq: new Map(), totalSpent: 0, count: 0, lastDate: "", catFreq: new Map() });
    }
    const g = map.get(normKey)!;
    g.totalSpent += Math.abs(tx.amount);
    g.count += 1;
    if (tx.date > g.lastDate) g.lastDate = tx.date;
    g.nameFreq.set(tx.description, (g.nameFreq.get(tx.description) ?? 0) + 1);
    if (tx.category) {
      g.catFreq.set(tx.category, (g.catFreq.get(tx.category) ?? 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([key, { nameFreq, totalSpent, count, lastDate, catFreq }]) => {
      // Most frequent name, tie-break alphabetically
      let bestName = "";
      let bestNameCount = 0;
      nameFreq.forEach((c, v) => {
        if (c > bestNameCount || (c === bestNameCount && v < bestName)) { bestName = v; bestNameCount = c; }
      });
      // Most frequent category, tie-break alphabetically
      let bestCat = "";
      let bestCatCount = 0;
      catFreq.forEach((c, v) => {
        if (c > bestCatCount || (c === bestCatCount && v < bestCat)) { bestCat = v; bestCatCount = c; }
      });
      return { key, name: bestName, totalSpent, count, lastDate, topCategory: bestCat };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export default function SuppliersTab({ transactions, timeRange, lang }: SuppliersTabProps) {
  const tr = t[lang];

  const groups = useMemo(() => {
    const active = filterByTimeRange(
      transactions.filter((tx) => !tx.isExcluded && tx.amount < 0),
      timeRange
    );
    return buildSupplierGroups(active);
  }, [transactions, timeRange]);

  const chartData = groups.slice(0, 10).map((g) => ({
    name: truncate(g.name, 20),
    totalSpent: g.totalSpent,
  }));

  const isEmpty = groups.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{tr.suppliersTab}</h2>
      </div>

      {isEmpty ? (
        <p className="text-gray-400 text-sm text-center py-12">{tr.noSuppliersPeriod}</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => "₪" + (v as number).toLocaleString("he-IL")}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => ["₪" + (v as number).toLocaleString("he-IL")]}
              />
              <Bar dataKey="totalSpent" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.supplierName}
                  </th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.categoryColumn}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.totalSpent}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.transactions}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.lastTransaction}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="text-start px-4 py-3 text-gray-800">{g.name}</td>
                    <td className="text-start px-4 py-3">
                      {g.topCategory ? (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {g.topCategory}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="text-end px-4 py-3 text-gray-700">
                      ₪{g.totalSpent.toLocaleString("he-IL")}
                    </td>
                    <td className="text-end px-4 py-3 text-gray-500">{g.count}</td>
                    <td className="text-end px-4 py-3 text-gray-500">
                      {g.lastDate ? g.lastDate.split("-").reverse().join("/") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
